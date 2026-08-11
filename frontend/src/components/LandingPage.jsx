import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-white">JAJR <span className="text-yellow-500">Procurement System</span></span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#services" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">SERVICES</a>
              <a href="#projects" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">PROJECTS</a>
              <a href="#capabilities" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">CAPABILITIES</a>
              <a href="#contact" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors">CONTACT</a>
              <Link 
                to="/login" 
                className="bg-yellow-500 text-gray-900 px-6 py-3 rounded text-sm font-bold hover:bg-yellow-400 transition-colors"
              >
                GET A FREE PROJECT CONSULTATION
              </Link>
            </div>
            <button className="md:hidden text-white">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div 
        className="relative overflow-hidden flex items-center"
        style={{
          minHeight: 'calc(100vh - 80px)',
          backgroundImage: `
            linear-gradient(to right, rgba(17, 24, 39, 0.95) 0%, rgba(17, 24, 39, 0.7) 50%, rgba(17, 24, 39, 0.4) 100%),
            url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10 w-full">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
              Bridging Dreams
              <span className="text-yellow-500 block">To Reality</span>
            </h1>
            <p className="mt-6 text-xl text-gray-300 leading-relaxed">
              Premier construction services delivering exceptional quality and innovative solutions for commercial, residential, and industrial projects.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link 
                to="/login" 
                className="bg-yellow-500 text-gray-900 px-8 py-4 rounded text-lg font-bold hover:bg-yellow-400 inline-flex items-center justify-center transition-colors"
              >
                GET A FREE PROJECT CONSULTATION
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <a 
                href="#projects" 
                className="border-2 border-white text-white px-8 py-4 rounded text-lg font-bold hover:bg-white hover:text-gray-900 inline-flex items-center justify-center transition-colors"
              >
                View Our Projects
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div id="services" className="py-24 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white">Our Services</h2>
            <p className="mt-4 text-xl text-gray-400">Comprehensive construction solutions for every need</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-800 rounded-lg p-8 hover:bg-gray-750 transition-colors border border-gray-700">
              <div className="w-14 h-14 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-6">
                <span className="text-yellow-500 text-2xl">🏗️</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Commercial Construction</h3>
              <p className="text-gray-400">Office buildings, retail spaces, and commercial complexes built to the highest standards.</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-8 hover:bg-gray-750 transition-colors border border-gray-700">
              <div className="w-14 h-14 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-6">
                <span className="text-yellow-500 text-2xl">🏠</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Residential Projects</h3>
              <p className="text-gray-400">Custom homes, renovations, and residential developments with attention to detail.</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-8 hover:bg-gray-750 transition-colors border border-gray-700">
              <div className="w-14 h-14 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-6">
                <span className="text-yellow-500 text-2xl">🏭</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Industrial Construction</h3>
              <p className="text-gray-400">Warehouses, factories, and industrial facilities designed for efficiency and safety.</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-8 hover:bg-gray-750 transition-colors border border-gray-700">
              <div className="w-14 h-14 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-6">
                <span className="text-yellow-500 text-2xl">🔧</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Renovation & Remodeling</h3>
              <p className="text-gray-400">Transform existing spaces with our expert renovation and remodeling services.</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-8 hover:bg-gray-750 transition-colors border border-gray-700">
              <div className="w-14 h-14 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-6">
                <span className="text-yellow-500 text-2xl">📐</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Design & Build</h3>
              <p className="text-gray-400">Integrated design and construction services for seamless project delivery.</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-8 hover:bg-gray-750 transition-colors border border-gray-700">
              <div className="w-14 h-14 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-6">
                <span className="text-yellow-500 text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Project Management</h3>
              <p className="text-gray-400">End-to-end project management ensuring timely and budget-conscious delivery.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div id="projects" className="py-24 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white">Featured Projects</h2>
            <p className="mt-4 text-xl text-gray-400">Showcasing our commitment to excellence</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group relative overflow-hidden rounded-lg">
              <div 
                className="h-80 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-xl font-bold text-white">Downtown Office Tower</h3>
                <p className="text-gray-300 mt-2">Commercial • 50,000 sq ft</p>
              </div>
            </div>
            
            <div className="group relative overflow-hidden rounded-lg">
              <div 
                className="h-80 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-xl font-bold text-white">Luxury Residential Complex</h3>
                <p className="text-gray-300 mt-2">Residential • 120 Units</p>
              </div>
            </div>
            
            <div className="group relative overflow-hidden rounded-lg">
              <div 
                className="h-80 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=600&q=80')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-xl font-bold text-white">Industrial Warehouse</h3>
                <p className="text-gray-300 mt-2">Industrial • 200,000 sq ft</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities Section */}
      <div id="capabilities" className="py-24 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-6">Our Capabilities</h2>
              <p className="text-xl text-gray-400 mb-8">
                With decades of experience and a team of skilled professionals, we have the expertise to handle projects of any scale and complexity.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-900 font-bold text-xl">✓</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-bold text-white">Licensed & Insured</h3>
                    <p className="text-gray-400 mt-1">Fully licensed contractors with comprehensive insurance coverage.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-900 font-bold text-xl">✓</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-bold text-white">Experienced Team</h3>
                    <p className="text-gray-400 mt-1">Skilled professionals with expertise in all construction disciplines.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-900 font-bold text-xl">✓</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-bold text-white">Quality Assurance</h3>
                    <p className="text-gray-400 mt-1">Rigorous quality control processes ensuring superior results.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-900 font-bold text-xl">✓</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-bold text-white">On-Time Delivery</h3>
                    <p className="text-gray-400 mt-1">Proven track record of completing projects on schedule.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div 
              className="h-96 rounded-lg bg-cover bg-center"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80')" }}
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-yellow-500 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900">Ready to Start Your Project?</h2>
          <p className="mt-4 text-xl text-gray-800">Contact us today for a free consultation and estimate.</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/login" 
              className="bg-gray-900 text-white px-8 py-4 rounded text-lg font-bold hover:bg-gray-800 inline-flex items-center justify-center transition-colors"
            >
              GET A FREE PROJECT CONSULTATION
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <a 
              href="#contact" 
              className="border-2 border-gray-900 text-gray-900 px-8 py-4 rounded text-lg font-bold hover:bg-gray-900 hover:text-white inline-flex items-center justify-center transition-colors"
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 py-16 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <span className="text-2xl font-bold text-white">JAJR <span className="text-yellow-500">Construction</span></span>
              <p className="mt-4 text-gray-400">Building excellence and delivering results since 2010.</p>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Services</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Commercial Construction</li>
                <li>Residential Projects</li>
                <li>Industrial Construction</li>
                <li>Renovation & Remodeling</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li>About Us</li>
                <li>Our Team</li>
                <li>Careers</li>
                <li>News</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Contact</h3>
              <ul className="space-y-2 text-gray-400">
                <li>info@jajrconstruction.com</li>
                <li>09668160595</li>
                <li>123 Construction Ave</li>
                <li>Pias, San Fernando, La Union</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; 2026 JAJR Construction. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage