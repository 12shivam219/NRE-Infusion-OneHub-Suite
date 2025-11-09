// Simple diagnostic script to test authentication
const testAuth = async () => {
  try {
    console.log('Testing authentication endpoint...');
    
    // Test if server is responding
    const healthResponse = await fetch('http://localhost:5000/health');
    console.log('Health check:', healthResponse.status, healthResponse.statusText);
    
    // Test auth endpoint
    const authResponse = await fetch('http://localhost:5000/api/auth/user', {
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    console.log('Auth endpoint status:', authResponse.status, authResponse.statusText);
    
    if (authResponse.status === 401) {
      console.log('✓ Auth endpoint working correctly (401 for unauthenticated user)');
    } else {
      const authData = await authResponse.text();
      console.log('Auth response:', authData);
    }
    
    // Test login endpoint with invalid credentials
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword'
      })
    });
    
    console.log('Login endpoint status:', loginResponse.status, loginResponse.statusText);
    const loginData = await loginResponse.text();
    console.log('Login response:', loginData);
    
  } catch (error) {
    console.error('Error testing auth:', error);
  }
};

testAuth();