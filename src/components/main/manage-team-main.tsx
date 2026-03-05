import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Plus } from "lucide-react";

const mockBarbers = [
  {
    id: "1",
    name: "João Silva",
    description: "Especialista em degradê",
    is_active: true,
    avatar_url: null,
  },
  {
    id: "2",
    name: "Pedro Alves",
    description: "Cortes clássicos e modernos",
    is_active: true,
    avatar_url: null,
  },
  {
    id: "3",
    name: "Lucas Mendes",
    description: "Barba e bigode",
    is_active: false,
    avatar_url: null,
  },
];

export function ManageTeamMain() {
  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-6 md:px-12 pb-12 mx-auto">
      <p className="text-sm text-muted-foreground">
        {mockBarbers.filter(b => b.is_active).length} barbeiros ativos
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {mockBarbers.map(barber => (
          <Card key={barber.id} className="relative">
            <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6">
              <Badge
                className="absolute top-3 right-3"
                variant={barber.is_active ? "default" : "secondary"}
              >
                {barber.is_active ? "Ativo" : "Inativo"}
              </Badge>
              <Avatar className="h-20 w-20">
                <AvatarImage src={barber.avatar_url ?? undefined} />
                <AvatarFallback className="text-xl">
                  {barber.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="font-semibold">{barber.name}</span>
                <span className="text-sm text-muted-foreground line-clamp-2">
                  {barber.description}
                </span>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="w-full cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Editar
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
          <CardContent className="flex flex-col items-center justify-center gap-3 pt-8 pb-6 h-full min-h-52">
            <div className="h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              Novo barbeiro
            </span>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
