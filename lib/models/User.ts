import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  gender: "male" | "female" | "other";
  phone: string;
  dob: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  gender: { type: String, required: true, enum: ["male", "female", "other"] },
  phone: { type: String, required: true },
  dob: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: String, required: true },
});

export const UserModel = mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);
