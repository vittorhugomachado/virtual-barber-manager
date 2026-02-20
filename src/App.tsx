import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function App() {
  return (
    <main className="w-full h-full px-4">
      <Alert className="max-w-150 m-auto">
        <AlertTitle>Página em construção</AlertTitle>
        <AlertDescription>
          Esse projeto está em desenvolvimento e ainda não possui uma interface
          de usuário na branch main (atual). Mude para branch develop.
        </AlertDescription>
      </Alert>
    </main>
  );
}

export default App;
