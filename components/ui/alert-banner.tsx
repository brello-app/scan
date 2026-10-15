export function AlertBanner({
  title,
  contents,
}: {
  title: string;
  contents: string;
}) {
  return (
    <div className="flex items-center gap-5 border border-destructive p-5 break-keep">
      <div>
        <p className="text-xl text-destructive font-semibold">{title}</p>
        <p className="text-destructive">{contents}</p>
      </div>
    </div>
  );
}
