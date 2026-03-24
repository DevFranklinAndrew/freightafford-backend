import jwt from "jsonwebtoken";
import envConfig from "../configurations/env.configuration.js";

interface JwtPayload {
  userId: string;
  role: string;
}

export const generateJWT = (payload: JwtPayload): string => {
  if (!envConfig.JWT_SECRET) throw new Error("JWT_SECRET not defined");

  return jwt.sign(payload, envConfig.JWT_SECRET, { expiresIn: "1d" });
};

export const verifyJWT = (token: string): JwtPayload => {
  if (!envConfig.JWT_SECRET) throw new Error("JWT_SECRET not defined");

  return jwt.verify(token, envConfig.JWT_SECRET) as JwtPayload;
};
