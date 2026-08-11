import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Login = () => {
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(employeeNo, password);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-900">
      {/* Background image with overlay */}
      <div 
        className="absolute inset-0 -z-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(17, 24, 39, 0.95) 0%, rgba(17, 24, 39, 0.85) 100%),
            url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <Lock className="h-6 w-6 text-yellow-500" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">
            JAJR <span className="text-yellow-500">Construction</span>
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Sign in with your employee credentials
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-md p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="employee-no" className="block text-sm font-medium text-gray-300">
                Employee Number
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="employee-no"
                  name="employeeNo"
                  type="text"
                  required
                  value={employeeNo}
                  onChange={(e) => setEmployeeNo(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md placeholder-gray-500 bg-gray-700 text-white focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                  placeholder="Enter your employee number"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-600 rounded-md placeholder-gray-500 bg-gray-700 text-white focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-500 hover:text-gray-300" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-500 hover:text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-gray-900 bg-yellow-500 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-yellow-500 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home page
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
