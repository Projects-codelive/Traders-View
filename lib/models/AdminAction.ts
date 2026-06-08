import mongoose, { Schema, Document } from "mongoose";

export interface IAdminAction extends Document {
  userId: string;
  userName: string;
  userEmail: string;
  action: "credit" | "debit";
  amount: number;
  signedAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

const AdminActionSchema = new Schema<IAdminAction>({
  userId:       { type: String, required: true },
  userName:     { type: String, required: true },
  userEmail:    { type: String, required: true },
  action:       { type: String, required: true, enum: ["credit", "debit"] },
  amount:       { type: Number, required: true },
  signedAmount: { type: Number, required: true },
  balanceBefore: { type: Number, required: true },
  balanceAfter:  { type: Number, required: true },
  createdAt:    { type: String, required: true },
});

if (mongoose.models.AdminAction) {
  delete mongoose.models.AdminAction;
}
export const AdminActionModel = mongoose.model<IAdminAction>("AdminAction", AdminActionSchema);
