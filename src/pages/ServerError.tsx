import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const ServerError = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-4">
    <div className="text-center">
      <h1 className="text-6xl font-bold text-destructive">500</h1>
      <p className="mt-4 text-xl font-medium">Something went wrong</p>
      <p className="mt-2 text-muted-foreground">We're working on fixing this. Please try again later.</p>
      <Link to="/"><Button className="mt-6">Go Home</Button></Link>
    </div>
  </div>
);

export default ServerError;
