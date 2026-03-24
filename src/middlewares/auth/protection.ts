import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import envConfig from "../../configurations/env.configuration.js";
import AppError from "../../errors/app.error.js";
import User from "../../models/user.model.js";
import type { AuthenticateRequest, JwtPayload } from "../../utils/interface.js";

export const authenticate = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction,
) => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  )
    token = req.headers.authorization.split(" ")[1];

  if (!token && req.cookies?.jwt) token = req.cookies.jwt;

  if (!token)
    return next(new AppError("Log in to access your dashboard.", 401));

  let decoded: JwtPayload;

  try {
    decoded = jwt.verify(token, envConfig.JWT_SECRET) as JwtPayload;
  } catch (error) {
    return next(new AppError("Invalid or expired token.", 401));
  }

  const user = await User.findById(decoded.userId);

  if (!user) return next(new AppError("User no longer exists.", 401));

  if (!user.isEmailVerified)
    return next(new AppError("Account not verified.", 403));

  req.user = user;

  next();
};

export const authorize =
  (...roles: string[]) =>
  (req: AuthenticateRequest, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Login is required!", 401));

    if (!roles.includes(req.user.role))
      return next(
        new AppError(
          `Only ${roles.join(", ").toUpperCase()} can access this dashboard.`,
          403,
        ),
      );

    next();
  };
