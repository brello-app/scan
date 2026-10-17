"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../ui/field";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import useDataStore from "@/lib/store/data-store";
import { waitlistFormSchema, type CTAFormData } from "@/lib/waitlist-schema";

const plans = [
  {
    value: "live-alerts",
    title: "Live leak alerts & auto-block",
    price: "$9/mo",
    description:
      "Get pinged within minutes and stop a leaked key before the bill grows.",
  },
  {
    value: "refund-help",
    title: "Refund help",
    price: "$29 per incident",
    description:
      "We build your refund case and help you through every reply from support.",
  },
  {
    value: "spike-cover",
    title: "Spike cover",
    price: "$39/mo",
    description: "If Brello misses a leaked key, we credit you for the damage.",
  },
  {
    value: "free-scan",
    title: "Just the free scan for now",
    price: "",
    description: "",
  },
] as const;

type ToastState = "joined" | "interview" | null;

const monthlySpendOptions = [
  { value: "under-50", label: "Under $50" },
  { value: "50-200", label: "$50–200" },
  { value: "200-1000", label: "$200–1,000" },
  { value: "over-1000", label: "Over $1,000" },
] as const;

const defaultValues: Omit<CTAFormData, "scanSource"> = {
  email: "",
  plans: [],
  monthlySpend: "",
  unexpectedBill: "",
  interviewOptIn: false,
};

export function CTAForm() {
  const source = useDataStore((state) => state.source);
  const [toast, setToast] = useState<ToastState>(null);
  const [showInterviewToast, setShowInterviewToast] = useState(false);
  const form = useForm<CTAFormData>({
    resolver: zodResolver(waitlistFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { ...defaultValues, scanSource: source },
  });

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => {
      if (toast === "joined" && showInterviewToast) {
        setToast("interview");
        setShowInterviewToast(false);
      } else {
        setToast(null);
      }
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [toast, showInterviewToast]);

  const onSubmit = async (form: CTAFormData) => {
    let res: Response;
    try {
      res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
    } catch {
      throw new Error("Could not join the waitlist. Please try again.");
    }

    const responseText = await res.text();
    let response: { error?: unknown } | null = null;
    try {
      response = JSON.parse(responseText);
    } catch {
      // Preserve the raw response below to make malformed API replies diagnosable.
    }

    if (!res.ok) {
      throw new Error(
        response && typeof response.error === "string"
          ? response.error
          : "Could not join the waitlist. Please try again.",
      );
    }

    if (!response) {
      throw new Error("Could not join the waitlist. Please try again.");
    }
  };

  const handleValidSubmit: SubmitHandler<CTAFormData> = async (data) => {
    form.clearErrors("root.server");

    try {
      await onSubmit({ ...data, scanSource: source });
      setShowInterviewToast(data.interviewOptIn);
      setToast("joined");
      form.reset({ ...defaultValues, scanSource: source });
    } catch (error) {
      form.setError("root.server", {
        type: "server",
        message:
          error instanceof Error
            ? error.message
            : "Could not join the waitlist. Please try again.",
      });
    }
  };

  return (
    <div className="bg-background text-foreground p-10">
      <div>
        <h2 className="text-2xl font-semibold">Get early access to Brello</h2>
        <p className="mt-2 text-sm text-primary-foreground/80">
          Scan is free forever. We’re building live protection next.
          <br />
          Tell us what you’d actually use.
        </p>
      </div>

      <form
        className="mt-10 flex flex-col gap-10"
        noValidate
        onSubmit={form.handleSubmit(handleValidSubmit)}
      >
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel
                className="text-base font-semibold"
                htmlFor="cta-email"
              >
                Email <span aria-hidden="true">*</span>
              </FieldLabel>
              <Input
                {...field}
                className="h-11 rounded-md border-border bg-background text-foreground"
                id="cta-email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
                aria-invalid={fieldState.invalid}
                aria-describedby={
                  fieldState.error ? "cta-email-error" : undefined
                }
              />
              {fieldState.error && (
                <FieldError id="cta-email-error" errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="plans"
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid} className="gap-3">
              <FieldLegend
                variant="label"
                className="mb-0 text-base font-semibold"
              >
                What would you pay for? <span aria-hidden="true">*</span>
              </FieldLegend>
              <FieldDescription>
                Choose all that apply. Select at least one.
              </FieldDescription>
              <FieldGroup data-slot="checkbox-group" className="gap-3">
                {plans.map((plan) => {
                  const checked = field.value.includes(plan.value);
                  const inputId = "plan-" + plan.value;

                  return (
                    <Field
                      key={plan.value}
                      orientation="horizontal"
                      data-invalid={fieldState.invalid}
                      className="items-start gap-3 rounded-lg border border-primary-foreground/20 p-3 has-checked:border-primary-foreground/60 has-checked:bg-primary-foreground/5"
                    >
                      <input
                        className="mt-1 size-4 shrink-0 accent-(--color-primary-foreground)"
                        id={inputId}
                        name={field.name}
                        type="checkbox"
                        value={plan.value}
                        checked={checked}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={
                          fieldState.error ? "cta-plans-error" : undefined
                        }
                        onBlur={field.onBlur}
                        onChange={(event) => {
                          const isChecked = event.currentTarget.checked;
                          const nextValues = isChecked
                            ? plan.value === "free-scan"
                              ? ["free-scan"]
                              : [
                                  ...field.value.filter(
                                    (value) => value !== "free-scan",
                                  ),
                                  plan.value,
                                ]
                            : field.value.filter(
                                (value) => value !== plan.value,
                              );

                          field.onChange(nextValues);
                        }}
                      />
                      <FieldContent className="gap-1">
                        <FieldLabel
                          className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium"
                          htmlFor={inputId}
                        >
                          <span className="font-semibold">{plan.title}</span>
                          {plan.price && <span>{"— " + plan.price}</span>}
                        </FieldLabel>
                        {plan.description && (
                          <FieldDescription className="text-primary-foreground/75">
                            {plan.description}
                          </FieldDescription>
                        )}
                      </FieldContent>
                    </Field>
                  );
                })}
              </FieldGroup>
              {fieldState.error && (
                <FieldError id="cta-plans-error" errors={[fieldState.error]} />
              )}
            </FieldSet>
          )}
        />

        <FieldSet className="gap-3">
          <FieldLegend variant="label" className="mb-0 text-base font-semibold">
            Roughly how much do you spend on AI APIs per month?
          </FieldLegend>
          <FieldGroup className="flex flex-row flex-wrap gap-x-5 gap-y-3 mt-3">
            {monthlySpendOptions.map((option) => (
              <Field
                key={option.value}
                orientation="horizontal"
                className="w-auto items-center gap-2"
              >
                <input
                  className="size-4 accent-(--color-primary-foreground)"
                  id={"spend-" + option.value}
                  type="radio"
                  value={option.value}
                  {...form.register("monthlySpend")}
                />
                <FieldLabel
                  className="text-sm font-normal"
                  htmlFor={"spend-" + option.value}
                >
                  {option.label}
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
        </FieldSet>

        <FieldSet className="gap-6">
          <FieldLegend variant="label" className="mb-0 text-base font-semibold">
            Have you ever been hit with an unexpected AI bill?
          </FieldLegend>
          <FieldGroup className="flex flex-row gap-5 mt-2">
            {[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ].map((option) => (
              <Field
                key={option.value}
                orientation="horizontal"
                className="w-auto items-center gap-2"
              >
                <input
                  className="size-4 accent-(--color-primary-foreground)"
                  id={"unexpected-bill-" + option.value}
                  type="radio"
                  value={option.value}
                  {...form.register("unexpectedBill")}
                />
                <FieldLabel
                  className="text-sm font-normal"
                  htmlFor={"unexpected-bill-" + option.value}
                >
                  {option.label}
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
        </FieldSet>

        <Controller
          control={form.control}
          name="interviewOptIn"
          render={({ field }) => (
            <Field
              orientation="horizontal"
              className="items-start gap-3 rounded-lg border border-primary-foreground/20 p-3"
            >
              <input
                className="mt-1 size-4 shrink-0 accent-(--color-primary-foreground)"
                id="cta-interview-opt-in"
                name={field.name}
                type="checkbox"
                checked={field.value}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
              <FieldContent className="gap-1">
                <FieldLabel
                  className="text-sm font-semibold"
                  htmlFor="cta-interview-opt-in"
                >
                  I’m happy to answer a few quick questions by email.
                </FieldLabel>
                <FieldDescription className="text-primary-foreground/75">
                  Helps us build the right thing. No calls, takes 5 minutes.
                </FieldDescription>
              </FieldContent>
            </Field>
          )}
        />

        <input type="hidden" {...form.register("scanSource")} value={source} />

        <div className="flex flex-col gap-3">
          <Button
            className="h-11 w-full rounded-md bg-primary text-primary-foreground p-3 cursor-pointer hover:bg-background/90"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            Join the waitlist
          </Button>
          {form.formState.errors.root?.server?.message && (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.root.server.message}
            </p>
          )}
          <p className="text-center text-xs leading-relaxed text-primary-foreground/75">
            Only launch updates. No spam. Unsubscribe anytime.
          </p>
          <p className="text-center text-xs leading-relaxed text-primary-foreground/75">
            We also note whether you scanned sample data or your own file. No
            usage numbers are sent.
          </p>
        </div>
      </form>

      {toast &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed bottom-5 right-5 z-9999 w-[min(24rem,calc(100vw-2.5rem))] rounded-xl border border-border bg-background p-5 text-foreground shadow-xl"
            role="status"
            aria-live="polite"
          >
            <p className="font-semibold">
              {toast === "joined"
                ? "You’re on the list. 🎉"
                : "Thanks for offering to help."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {toast === "joined"
                ? "We’ll email you when live protection is ready."
                : "We’ll send you a few short questions in the next couple of days."}
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}
