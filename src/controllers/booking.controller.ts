import type { NextFunction, Request, Response } from "express";
import AppError from "../errors/app.error.js";
import Booking from "../models/booking.model.js";
import {
  sendBookingScheduleNotification,
  sendShipmentStatusUpdate,
} from "../services/booking.services.js";
import type {
  AuthenticateRequest,
  IFreightRequest,
  IUser,
} from "../utils/interface.js";
import { createTrackingEvent } from "./tracking.controller.js";

export const getMyBookings = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction,
) => {
  const bookings = await Booking.find({ customer: req.user!._id })
    .populate("freightRequest")
    .populate("customer")
    .sort({ createdAt: -1 });

  res
    .status(200)
    .json({ status: "success", results: bookings.length, data: bookings });
};

// ADMIN: Get All Bookings
export const getAllBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const bookings = await Booking.find()
    .populate("customer", "fullname email companyName")
    .populate("freightRequest")
    .sort({ createdAt: -1 });

  res
    .status(200)
    .json({ status: "success", results: bookings.length, data: bookings });
};

export const getSingleBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const booking = await Booking.findById(req.params.id)
    .populate("customer", "fullname email companyName")
    .populate("freightRequest");

  if (!booking) return next(new AppError("Booking not found", 404));

  res.status(200).json({ status: "success", data: booking });
};

// ADMIN: Update Shipping Details
export const updateBookingShipping = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { shippingLine, vessel, sailingDate, carrierBookingNumber } = req.body;
  const booking = await Booking.findById(req.params.id).populate(
    "customer",
    "email fullname",
  );

  if (!booking) return next(new AppError("Booking not found", 404));
  const customer = booking.customer as unknown as IUser;

  booking.shippingLine = shippingLine;
  booking.vessel = vessel;
  booking.sailingDate = sailingDate;
  booking.carrierBookingNumber = carrierBookingNumber;

  const { error } = await sendBookingScheduleNotification(
    customer.email,
    customer.fullname,
    carrierBookingNumber,
    shippingLine,
    vessel,
    booking.sailingDate,
  );

  if (error)
    return next(
      new AppError("Unable to send booking schedule notification", 400),
    );

  await booking.save();

  res.status(200).json({
    status: "success",
    message: "Booking details updated sent to client.",
    data: booking,
  });
};

// ADMIN: Update Booking Status
export const updateBookingStatus = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction,
) => {
  const { status } = req.body;

  const booking = await Booking.findById(req.params.id)
    .populate("customer", "email fullname")
    .populate("freightRequest", "originPort destinationPort");

  if (!booking) return next(new AppError("Booking not found", 404));

  const allowedTransitions: Record<string, string[]> = {
    awaiting_confirmation: ["confirmed", "cancelled"],
    confirmed: ["in_transit", "cancelled"],
    in_transit: ["arrived", "cancelled"],
    arrived: ["delivered", "cancelled"],
    delivered: [],
    cancelled: [],
  };

  const currentStatus = booking.status;
  const validNextStatuses = allowedTransitions[currentStatus];

  if (!validNextStatuses?.includes(status))
    return next(
      new AppError(
        `Invalid status transition from "${currentStatus}" to "${status}"`,
        400,
      ),
    );

  const request = booking.freightRequest as unknown as IFreightRequest;

  const customer = booking.customer as unknown as IUser;

  const { error } = await sendShipmentStatusUpdate(
    customer.email,
    customer.fullname,
    booking.bookingNumber,
    status,
  );

  if (error)
    return next(new AppError("Booking status Notification email failed", 400));

  await createTrackingEvent({
    bookingId: booking._id.toString(),
    event: status,
    description: `Shipment status updated to ${status}`,
    location: {
      originPort: request.originPort,
      destinationPort: request.destinationPort,
    },
    userId: req.user!._id.toString(),
  });

  res.status(200).json({
    status: "success",
    message: "Booking status updated",
    data: booking,
  });
};
