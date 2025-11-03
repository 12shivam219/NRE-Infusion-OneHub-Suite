import { Card, CardContent } from '@/components/ui/card';
import { FileText, CreditCard as Edit, Download } from 'lucide-react';

export default function FeaturesSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card">
      <div className="max-w-6xl mx-auto">
        <h3 className="text-4xl font-bold text-center text-foreground mb-16 tracking-tight">
          Everything You Need to Stand Out
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="border-border card-interactive shadow-md">
            <CardContent className="p-8">
              <div className="h-14 w-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mb-6">
                <FileText className="text-primary" size={26} />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-3">DOCX Upload & Editing</h4>
              <p className="text-muted-foreground leading-relaxed">
                Upload your existing resume and edit it with our powerful rich-text editor. Full
                Microsoft Word compatibility.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border card-interactive shadow-md">
            <CardContent className="p-8">
              <div className="h-14 w-14 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl flex items-center justify-center mb-6">
                <Edit className="text-accent" size={26} />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-3">
                Smart Tech Stack Processing
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                Organize your technical skills and bullet points into strategic groups for targeted
                job applications.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border card-interactive shadow-md">
            <CardContent className="p-8">
              <div className="h-14 w-14 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl flex items-center justify-center mb-6">
                <Download className="text-orange-600" size={26} />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-3">Export & Cloud Storage</h4>
              <p className="text-muted-foreground leading-relaxed">
                Download as DOCX/PDF or save directly to Google Drive. Access your resumes anywhere.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
