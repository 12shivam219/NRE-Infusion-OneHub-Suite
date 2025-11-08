// Simple circuit breaker to prevent infinite auth loops
class AuthCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private isOpen = false;
  private readonly maxFailures = 20; // Even higher threshold to prevent false positives
  private readonly resetTimeout = 3000; // Slightly longer reset

  shouldAllowRequest(): boolean {
    const now = Date.now();
    
    // Reset if enough time has passed
    if (this.isOpen && (now - this.lastFailureTime) > this.resetTimeout) {
      this.reset();
    }
    
    return !this.isOpen;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Only trigger for truly excessive failures
    if (this.failureCount >= this.maxFailures) {
      this.isOpen = true;
      console.warn(`Auth circuit breaker opened - ${this.failureCount} failures detected`);
      // Auto-reset quickly
      setTimeout(() => {
        console.log('Auth circuit breaker auto-reset');
        this.reset();
      }, this.resetTimeout);
    }
  }

  recordSuccess(): void {
    this.reset();
  }

  reset(): void {
    this.failureCount = 0;
    this.isOpen = false;
    this.lastFailureTime = 0;
  }

  isCircuitOpen(): boolean {
    return this.isOpen;
  }
}

export const authCircuitBreaker = new AuthCircuitBreaker();
