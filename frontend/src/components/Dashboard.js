import React, { useState, useEffect } from 'react';
import { EyeIcon, EyeSlashIcon, KeyIcon, PencilIcon, TrashIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const [accounts, setAccounts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    website: '',
    name: '',
    username: '',
    email: '',
    password: '',
    attachedFile: null,
    note: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const response = await fetch('/api/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to fetch accounts');
      }

      const data = await response.json();
      console.log('Fetched accounts:', data); // Debug log
      setAccounts(data);
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError(err.message || 'Failed to fetch accounts');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({
      ...prev,
      attachedFile: e.target.files[0]
    }));
  };

  const generatePassword = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/accounts/generate-password', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate password');
      }
      
      const data = await response.json();
      setFormData(prev => ({ ...prev, password: data.password }));
    } catch (error) {
      setError('Failed to generate password');
      console.error('Password generation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewFile = (filePath) => {
    if (filePath) {
      const filename = filePath.split('/').pop();
      const encodedFilename = encodeURIComponent(filename);
      const fileUrl = `/api/accounts/files/${encodedFilename}`;
      
      // For images, show in a modal/new window
      if (/\.(jpg|jpeg|png|gif|svg)$/i.test(filename)) {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head>
                <title>Image Viewer - ${filename}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body {
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background: #1a1a1a;
                    font-family: system-ui, -apple-system, sans-serif;
                  }
                  .container {
                    max-width: 95vw;
                    max-height: 95vh;
                    position: relative;
                  }
                  img {
                    max-width: 100%;
                    max-height: 90vh;
                    object-fit: contain;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    display: block;
                    margin: 0 auto;
                  }
                  .filename {
                    color: white;
                    text-align: center;
                    margin-top: 10px;
                    font-size: 14px;
                  }
                  .error {
                    color: #ff4444;
                    text-align: center;
                    padding: 20px;
                    background: rgba(0, 0, 0, 0.5);
                    border-radius: 8px;
                    display: none;
                  }
                  .loading {
                    color: white;
                    text-align: center;
                    margin-bottom: 10px;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="loading">Loading image...</div>
                  <img 
                    src="${fileUrl}"
                    alt="${filename}"
                    onload="this.style.display='block'; document.querySelector('.loading').style.display='none';"
                    onerror="this.style.display='none'; document.querySelector('.error').style.display='block'; document.querySelector('.loading').style.display='none';"
                    style="display: none;"
                  />
                  <div class="filename">${filename}</div>
                  <div class="error">
                    Error loading image. The file may no longer exist or you may not have permission to view it.
                  </div>
                </div>
                <script>
                  // Add authorization header to image request
                  const img = document.querySelector('img');
                  const token = localStorage.getItem('token');
                  if (token) {
                    fetch(img.src, {
                      headers: {
                        'Authorization': 'Bearer ' + token
                      }
                    })
                    .then(response => response.blob())
                    .then(blob => {
                      img.src = URL.createObjectURL(blob);
                    })
                    .catch(error => {
                      document.querySelector('.error').style.display = 'block';
                      document.querySelector('.loading').style.display = 'none';
                    });
                  }
                </script>
              </body>
            </html>
          `);
        } else {
          // If popup is blocked, try to open in new tab
          window.open(fileUrl, '_blank');
        }
      } else {
        // For other files, fetch with authorization and trigger download
        fetch(fileUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        .then(response => {
          if (!response.ok) throw new Error('File download failed');
          return response.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch(error => {
          setError('Failed to download file');
          console.error('File download error:', error);
        });
      }
    }
  };

  const handleEdit = (account) => {
    setFormData({
      _id: account._id,
      website: account.website,
      name: account.name,
      username: account.username,
      email: account.email,
      password: account.password,
      note: account.note,
      attachedFile: account.attachedFile || null
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formDataToSend = new FormData();
    Object.keys(formData).forEach(key => {
      if (key === 'attachedFile' && formData[key]) {
        formDataToSend.append(key, formData[key]);
      } else if (key !== 'attachedFile' && key !== '_id') {
        formDataToSend.append(key, formData[key]);
      }
    });

    try {
      const url = formData._id 
        ? `/api/accounts/${formData._id}`
        : '/api/accounts';
      
      const method = formData._id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error('Failed to save account');
      }

      setFormData({
        website: '',
        name: '',
        username: '',
        email: '',
        password: '',
        attachedFile: null,
        note: ''
      });
      setShowAddForm(false);
      fetchAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      fetchAccounts();
    } catch (err) {
      setError('Failed to delete account');
    }
  };

  const handleAddNew = () => {
    setFormData({
      website: '',
      name: '',
      username: '',
      email: '',
      password: '',
      attachedFile: null,
      note: ''
    });
    setShowAddForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Personal Data Manager</h1>
          <div className="flex items-center space-x-4">
            <span>{user?.name}</span>
            <button
              onClick={logout}
              className="bg-red-600 px-4 py-2 rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto p-4">
        {!showAddForm ? (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-300">Accounts</h2>
            <button
              onClick={handleAddNew}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Add Account
            </button>
          </div>
        ) : (
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <button
              onClick={() => setShowAddForm(false)}
              className="bg-purple-600 px-4 py-2 rounded-md hover:bg-purple-700 mb-4"
            >
              Cancel
            </button>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500 text-white p-3 rounded">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Website
                </label>
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2">Password</label>
                <div className="relative">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline bg-gray-800 text-white"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
                    <button
                      type="button"
                      onClick={() => setPasswordVisible(!passwordVisible)}
                      className="text-gray-400 hover:text-white"
                    >
                      {passwordVisible ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-gray-400 hover:text-white"
                      title="Generate Password"
                    >
                      <KeyIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Attached File
                </label>
                {formData._id && formData.attachedFile && (
                  <div className="mb-2 flex items-center space-x-2 text-sm text-gray-300">
                    <span>Current file: </span>
                    <span className="text-blue-400">{formData.attachedFile.split('/').pop()}</span>
                    <button
                      type="button"
                      onClick={() => handleViewFile(formData.attachedFile)}
                      className="text-blue-500 hover:text-blue-400 ml-2"
                    >
                      <DocumentIcon className="h-5 w-5 inline" />
                      <span className="ml-1">View</span>
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  name="attachedFile"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-gray-300
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-600 file:text-white
                    hover:file:bg-indigo-700"
                />
                {formData._id && (
                  <p className="mt-1 text-sm text-gray-400">
                    Upload a new file to replace the existing one
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Note
                </label>
                <textarea
                  name="note"
                  value={formData.note}
                  onChange={handleInputChange}
                  rows="3"
                  className="mt-1 block w-full rounded-md border-gray-700 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Account'}
              </button>
            </form>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  SERIAL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  WEBSITE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  NAME
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  USERNAME
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  EMAIL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  PASSWORD
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  NOTE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  FILE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {accounts.map((account) => (
                <tr key={account._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {account.serialNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {account.logo && (
                        <img
                          src={account.logo}
                          alt={`${account.website} logo`}
                          className="h-6 w-6 mr-2 rounded-sm object-contain"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(account.website)}&background=random&size=128`;
                          }}
                        />
                      )}
                      <span className="text-sm text-gray-300">{account.website}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {account.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {account.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {account.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <input
                        type={showPassword[account._id] ? "text" : "password"}
                        value={account.password}
                        readOnly
                        className="bg-transparent border-none text-white text-sm w-full"
                      />
                      <button
                        onClick={() => setShowPassword(prev => ({
                          ...prev,
                          [account._id]: !prev[account._id]
                        }))}
                        className="text-gray-400 hover:text-white"
                      >
                        {showPassword[account._id] ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {account.note && (
                      <span title={account.note} className="cursor-help">
                        {account.note.length > 20 ? account.note.substring(0, 20) + '...' : account.note}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {account.attachedFile && (
                      <button
                        onClick={() => handleViewFile(account.attachedFile)}
                        className="text-blue-500 hover:text-blue-400"
                      >
                        View File
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(account)}
                        className="text-yellow-500 hover:text-yellow-400"
                        title="Edit"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      {account.attachedFile && (
                        <button
                          onClick={() => handleViewFile(account.attachedFile)}
                          className="text-blue-500 hover:text-blue-400"
                          title="View File"
                        >
                          <DocumentIcon className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(account._id)}
                        className="text-red-500 hover:text-red-400"
                        title="Delete"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 