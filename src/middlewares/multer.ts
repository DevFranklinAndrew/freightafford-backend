import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (file.mimetype === "application/pdf") cb(null, true);
  else cb(new Error("Only PDF Files are allowed"));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
