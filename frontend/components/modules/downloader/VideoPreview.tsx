import { Card } from "@/components/ui/Card";

interface VideoPreviewProps {
    title: string;
    thumbnail: string;
}

export function VideoPreview({ title, thumbnail }: VideoPreviewProps) {
    if (!title) return null;

    return (
        <Card className="w-full overflow-hidden bg-zinc-950/50">
            <div className="aspect-video relative bg-zinc-900">
                {thumbnail ? (
                    <img src={thumbnail} alt={title} className="object-cover w-full h-full opacity-90 hover:opacity-100 transition-opacity" />
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-700">No Preview</div>
                )}
            </div>
            <div className="p-4 border-t border-zinc-900">
                <h3 className="text-zinc-200 font-medium line-clamp-2 tracking-tight">{title}</h3>
            </div>
        </Card>
    );
}
