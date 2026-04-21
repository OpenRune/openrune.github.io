import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePlaceholderPageProps = {
  title: string;
  description: string;
  minHeightClassName?: string;
};

export function ModulePlaceholderPage({
  title,
  description,
  minHeightClassName = "min-h-[10rem]",
}: ModulePlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent>
          <div className={`rounded-lg border border-dashed border-border/80 bg-muted/10 ${minHeightClassName}`} />
        </CardContent>
      </Card>
    </div>
  );
}
