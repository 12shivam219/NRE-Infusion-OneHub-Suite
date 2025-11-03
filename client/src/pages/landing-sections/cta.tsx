import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function CTASection() {
  return (
    <section className="py-20 bg-gradient-to-r from-primary to-accent">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl font-bold text-white mb-6">Ready to Transform Your Resume?</h2>
        <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          Join thousands of professionals who have already enhanced their job search with our
          AI-powered resume builder.
        </p>
        <Button
          size="lg"
          variant="secondary"
          className="bg-white text-primary hover:bg-white/90 smooth-hover shadow-xl text-lg px-8 py-6 h-auto"
          onClick={() => (window.location.href = '/register')}
        >
          Get Started Now
          <ArrowRight className="ml-2" size={22} />
        </Button>
      </div>
    </section>
  );
}
