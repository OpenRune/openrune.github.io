import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface QueryBuilderButtonProps {
    onClick: () => void;
}

export function QueryBuilderButton({ onClick }: QueryBuilderButtonProps) {
    return (
        <div className="absolute bottom-[5px] left-[5px] z-[1000] pointer-events-auto">
            <Card className="p-2">
                <Button
                    onClick={onClick}
                    title="Open Region Query Builder"
                    variant="outline"
                    className="bg-black border-border hover:bg-gray-800 text-white"
                >
                    <Search className="h-4 w-4 mr-2" />
                    Query Builder
                </Button>
            </Card>
        </div>
    );
}

