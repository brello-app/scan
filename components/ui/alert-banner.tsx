import { Provider } from "@/lib/data-normalizer";
import Link from "next/link";

export function AlertBanner({
  title,
  contents,
  provider,
}: {
  title: string;
  contents: string;
  provider: Provider;
}) {
  const revokeURL: Record<Provider, string> = {
    openai: "https://platform.openai.com/settings/profile/api-keys",
    anthropic: "https://platform.claude.com/settings/keys",
  };
  return (
    <div
      role="alert"
      className="mb-2 flex items-center gap-5 border border-destructive bg-destructive/5 p-5 break-keep justify-between"
    >
      <div className="flex-1">
        <p className="text-xl text-destructive font-semibold">{title}</p>
        <p className="text-destructive text-sm">{contents}</p>
      </div>
      <div>
        <Link
          className={"border border-destructive p-2 text-xs text-destructive"}
          href={revokeURL[provider]}
          target="_blank"
        >
          Revoke Your API Key
        </Link>
      </div>
    </div>
  );
}
