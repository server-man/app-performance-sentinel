import { Button } from "@/components/ui/button";
import { Zap, Database, Shield } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Hero */}
      <main className="container flex flex-col items-center justify-center min-h-screen py-12 text-center">
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-sm rounded-full bg-primary/10 text-primary">
            <Zap className="w-4 h-4" />
            <span>Clean Architecture Ready</span>
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Build{" "}
            <span className="text-primary">Fast</span>
          </h1>
          
          <p className="max-w-md mx-auto mt-4 text-lg text-muted-foreground">
            Mobile-first. Performance-optimized. Edge-ready.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid w-full max-w-2xl gap-4 mt-12 sm:grid-cols-3" style={{ animationDelay: "100ms" }}>
          <FeatureCard 
            icon={<Zap className="w-5 h-5" />}
            title="Edge Functions"
            description="Cold-start optimized"
          />
          <FeatureCard 
            icon={<Database className="w-5 h-5" />}
            title="Database"
            description="Realtime sync"
          />
          <FeatureCard 
            icon={<Shield className="w-5 h-5" />}
            title="Auth"
            description="Built-in security"
          />
        </div>

        {/* CTA */}
        <div className="flex gap-3 mt-12 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <Button size="lg" className="touch-target">
            Get Started
          </Button>
          <Button variant="outline" size="lg" className="touch-target">
            Learn More
          </Button>
        </div>
      </main>
    </div>
  );
};

const FeatureCard = ({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <div className="p-6 transition-colors rounded-lg bg-card hover:bg-secondary/50 animate-slide-up">
    <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 rounded-lg bg-primary/10 text-primary">
      {icon}
    </div>
    <h3 className="font-medium">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
  </div>
);

export default Index;
