export default function ProcessSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h3 className="text-3xl font-bold text-center text-foreground mb-12">How It Works</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary-foreground">1</span>
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">Upload Resume</h4>
            <p className="text-muted-foreground">Upload your DOCX resume files</p>
          </div>

          <div className="text-center">
            <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary-foreground">2</span>
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">Add Tech Stacks</h4>
            <p className="text-muted-foreground">Input your technical skills and bullet points</p>
          </div>

          <div className="text-center">
            <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary-foreground">3</span>
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">Generate Groups</h4>
            <p className="text-muted-foreground">AI organizes points into strategic groups</p>
          </div>

          <div className="text-center">
            <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary-foreground">4</span>
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">Customize & Export</h4>
            <p className="text-muted-foreground">Edit and download your tailored resume</p>
          </div>
        </div>
      </div>
    </section>
  );
}