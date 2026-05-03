import httpStatus from "http-status";
import { AppError, hashUrl, getShortCode, getRandomHashCode, validateLongUrl } from "../utils/index.js";
import { redisClient, mysqlClient } from "../../../almonds-static/configs/index.js";
import crypto from 'crypto';

const openCompression = async (body) => {
  try {
    console.log("inside openCompression method, request body: ", body);
    if (!body || !body.longUrl) {
      throw new AppError(httpStatus.status.BAD_REQUEST, "Invalid Request");
    }

    const { longUrl, customDomain } = body;
    const domain = customDomain || process.env.SHORTLY_BASE_URL;

    const MAX_ATTEMPTS = parseInt(process.env.MAX_COLLISION_RESOLUTION_ATTEMPT) || 50;
    const HASHING_METHOD = process.env.HASHING_METHOD;
    console.log("HASHING_METHOD: ", HASHING_METHOD);
    
    let attempt = 0;
    let shortCode, hashedUrl;

    while (attempt < MAX_ATTEMPTS) {
        attempt++;

        if(HASHING_METHOD == "RANDOM_BYTES") {
            shortCode = getRandomHashCode(process.env.SHORT_CODE_LENGTH);
        } else {
            hashedUrl = hashUrl(longUrl, process.env.HASHING_MODE);
            shortCode = getShortCode(hashedUrl, process.env.SHORT_CODE_LENGTH);
        }
        
        console.log("shortCode: ", shortCode);
        let existingLongUrl = await redisClient.get(`shortCode:${shortCode}::domain:${domain}`);
        try {
            const id = crypto.randomUUID();
            console.log("url Id: ", id);

            if(!existingLongUrl) {
                const [rows] = await mysqlClient.execute(
                    'SELECT long_url FROM urls WHERE short_code = ?', 
                    [shortCode]
                );
    
                if (rows.length > 0) {
                    existingLongUrl = rows[0].long_url;
                }
            }

            if(existingLongUrl && existingLongUrl.toLowerCase() === longUrl.toLowerCase()) {
                throw new AppError(httpStatus.status.CONFLICT, "URL already exists in database");
            }
            
            const resultSet = await mysqlClient.execute(
                `INSERT INTO urls (id, short_code, domain, long_url) VALUES (?, ?, ?, ?)`,
                [id, shortCode, domain, longUrl]
            );

            console.log("resultSet: ", resultSet);

            await redisClient.set(`shortCode:${shortCode}::domain:${domain}`, longUrl, 
                "EX", process.env.REDIS_LONG_URL_EXPIRE_DURATION * 60
            );

            await redisClient.set(`shortCode:${shortCode}::domain`, domain,
                "EX", process.env.REDIS_LONG_URL_EXPIRE_DURATION * 60
            );

            break;

        } catch (error) {
            console.log("error occured: ", error);
            if (error.code === 'ER_DUP_ENTRY') continue;
            else throw new AppError(error.statusCode ?? httpStatus.status.INTERNAL_SERVER_ERROR, error.message ?? "Something went wrong");
        }
    }

    if (attempt === MAX_ATTEMPTS) {
        throw new AppError(httpStatus.status.INTERNAL_SERVER_ERROR, "Too many collisions. Please try again.");
    }

    return {
      code: 200,
      shortUrl: `${domain}/${shortCode}`,
    };

  } catch (error) {
    console.error("error occurred in openCompression: ", error);
    throw new AppError(error.statusCode ?? httpStatus.status.INTERNAL_SERVER_ERROR, error.message ?? "Something went wrong");
  }
};

const redirectService = async(params) => {
    try {
        const shortCode  = params[0];
        console.log("inside redirectService method, request params: ", { shortCode });
        if(!shortCode || (typeof shortCode != 'string') || shortCode.length != process.env.SHORT_CODE_LENGTH) {
            throw new AppError(httpStatus.status.BAD_REQUEST, "Invalid Request");
        }

        const domain = await redisClient.get(`shortCode:${shortCode}::domain`);
        console.log("domain: ", domain);
        let longUrl = await redisClient.get(`shortCode:${shortCode}::domain:${domain}`);
        console.log("longUrl from cache layer: ", longUrl);

        if(!longUrl) {
            const [rows] = await mysqlClient.execute(
                'SELECT domain, long_url FROM urls WHERE short_code = ?', 
                [shortCode]
            );

            if (rows.length > 0) {
                longUrl = rows[0].long_url;
                console.log("longUrl from DB layer: ", longUrl);
                validateLongUrl(longUrl);
                
                await redisClient.set(`shortCode:${shortCode}::domain:${rows[0].domain}`, longUrl,
                    "EX", process.env.REDIS_LONG_URL_EXPIRE_DURATION * 60
                );

                await redisClient.set(`shortCode:${shortCode}::domain`, rows[0].domain,
                    "EX", process.env.REDIS_LONG_URL_EXPIRE_DURATION * 60
                );
            }
        }

        if(!longUrl) throw new AppError(httpStatus.status.NOT_ACCEPTABLE, "Requested URL no longer exist");
        validateLongUrl(longUrl);

        return {
            code: 200,
            url: longUrl
        };
        
    } catch (error) {
        console.log("error occured in redirectService: ", error);
        throw new AppError(error.statusCode ?? httpStatus.status.INTERNAL_SERVER_ERROR, error.message ?? "Something went wrong, please try again");
    }
};

export default {
    openCompression,
    redirectService,
};