import { z } from "zod";

const planValues = [
  "live-alerts",
  "refund-help",
  "spike-cover",
  "free-scan",
] as const;

const monthlySpendValues = [
  "under-50",
  "50-200",
  "200-1000",
  "over-1000",
] as const;

export const waitlistFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
  plans: z
    .array(z.enum(planValues))
    .min(1, "Choose at least one plan.")
    .refine(
      (values) => !values.includes("free-scan") || values.length === 1,
      "Choose the free scan or paid plans, not both.",
    ),
  monthlySpend: z.enum(monthlySpendValues).or(z.literal("")),
  unexpectedBill: z.enum(["yes", "no"]).or(z.literal("")),
  interviewOptIn: z.boolean(),
  scanSource: z.enum(["sample", "upload"]),
});

export type CTAFormData = z.infer<typeof waitlistFormSchema>;
