const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../middleware/authMiddleware');
const Account = require('../models/Account');
const mime = require('mime');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Helper function to fetch website logo
async function fetchWebsiteLogo(website) {
  try {
    // Add https:// prefix if no protocol specified
    const websiteUrl = website.startsWith('http') ? website : `https://${website}`;
    
    // Try to parse the URL
    let url;
    try {
      url = new URL(websiteUrl);
    } catch (error) {
      // For text-based logos, remove protocol if it exists
      const cleanName = website.replace(/^https?:\/\//, '');
      console.log(`Invalid URL, using text-based logo for: ${cleanName}`);
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=random&size=128`;
    }
    
    const hostname = url.hostname;

    // Special handling for known sites
    const knownSites = {
      'github.com': 'https://github.githubassets.com/favicons/favicon.svg',
      'mongodb.com': 'https://www.mongodb.com/assets/images/global/favicon.ico'
    };

    if (knownSites[hostname]) {
      console.log(`Using predefined logo for ${hostname}`);
      return knownSites[hostname];
    }
    
    // Try to fetch the favicon from icon.horse
    console.log(`Trying icon.horse for ${hostname}`);
    const iconHorseUrl = `https://icon.horse/icon/${hostname}`;
    const response = await fetch(iconHorseUrl, { 
      timeout: 5000,
      headers: {
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    
    if (response.ok) {
      console.log(`Successfully fetched logo from icon.horse for ${hostname}`);
      return iconHorseUrl;
    }
    
    // Try Google Favicon service
    console.log(`Trying Google favicon service for ${hostname}`);
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
    const googleResponse = await fetch(googleFaviconUrl, { 
      timeout: 5000,
      headers: {
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    
    if (googleResponse.ok) {
      console.log(`Successfully fetched Google favicon for ${hostname}`);
      return googleFaviconUrl;
    }
    
    // If both favicon services fail, return a text-based logo
    console.log(`No favicon found, using text-based logo for: ${hostname}`);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(hostname)}&background=random&size=128`;
    
  } catch (error) {
    console.error('Error in fetchWebsiteLogo:', error);
    // Return text-based logo as final fallback
    const cleanName = website.replace(/^https?:\/\//, '');
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=random&size=128`;
  }
}

// @route   GET /api/accounts/generate-password
// @desc    Generate a strong password
// @access  Private
router.get('/generate-password', protect, (req, res) => {
  try {
    const password = Account.generateStrongPassword();
    res.json({ password });
  } catch (error) {
    console.error('Password generation error:', error);
    res.status(500).json({ message: 'Error generating password' });
  }
});

// File viewing route
router.get('/files/:filename', protect, (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    // Remove any path traversal attempts
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(__dirname, '../uploads', sanitizedFilename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ message: 'File not found' });
    }

    // Get file stats
    const stat = fs.statSync(filePath);

    // Get file extension
    const ext = path.extname(sanitizedFilename).toLowerCase();
    
    // Set content type based on file extension
    const contentType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }[ext] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');

    // For images, set additional headers
    if (contentType.startsWith('image/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    // Create read stream with error handling
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming file' });
      }
    });

    // Pipe the file stream to response
    fileStream.pipe(res);

    // Handle client disconnect
    req.on('close', () => {
      fileStream.destroy();
    });

  } catch (error) {
    console.error('File viewing error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error viewing file' });
    }
  }
});

// @route   POST /api/accounts
// @desc    Create new account
// @access  Private
router.post(
  '/',
  [
    protect,
    upload.single('attachedFile'),
    [
      check('website', 'Website is required').not().isEmpty(),
      check('name', 'Name is required').not().isEmpty(),
      check('username', 'Username is required').not().isEmpty(),
      check('email', 'Please include a valid email').isEmail(),
      check('password', 'Password is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { website, name, username, email, password, note } = req.body;

      // Check for unique username and website combination
      const existingAccount = await Account.findOne({ website, username });
      if (existingAccount) {
        return res.status(400).json({
          message: 'An account with this username already exists for this website'
        });
      }

      // Check for unique email and website combination
      const existingEmail = await Account.findOne({ website, email });
      if (existingEmail) {
        return res.status(400).json({
          message: 'An account with this email already exists for this website'
        });
      }

      // Fetch logo with logging
      console.log(`Fetching logo for website: ${website}`);
      const logo = await fetchWebsiteLogo(website);
      console.log(`Logo URL fetched: ${logo}`);

      const newAccount = new Account({
        website,
        name,
        username,
        email,
        password,
        logo,
        note,
        user: req.user.id,
        attachedFile: req.file ? req.file.path.replace(/\\/g, '/') : undefined
      });

      const account = await newAccount.save();
      console.log(`Account created successfully with logo: ${account.logo}`);
      res.status(201).json(account);
    } catch (err) {
      console.error('Account creation error:', err);
      if (err.code === 11000) {
        return res.status(400).json({ 
          message: 'Duplicate entry found. Please check username and email combination.' 
        });
      }
      res.status(500).json({ 
        message: 'Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// @route   GET /api/accounts
// @desc    Get all accounts for a user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const accounts = await Account.find({ user: req.user.id });
    res.json(accounts);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/accounts/:id
// @desc    Get account by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Make sure user owns account
    if (account.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(account);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/accounts/:id
// @desc    Update account
// @access  Private
router.put(
  '/:id',
  [
    protect,
    upload.single('attachedFile'),
    [
      check('website', 'Website is required').not().isEmpty(),
      check('name', 'Name is required').not().isEmpty(),
      check('username', 'Username is required').not().isEmpty(),
      check('email', 'Please include a valid email').isEmail(),
      check('password', 'Password is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    try {
      let account = await Account.findById(req.params.id);
      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // Check ownership
      if (account.user.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized' });
      }

      const { website, username, password, email, note } = req.body;
      const logo = await fetchWebsiteLogo(website);

      // Use Object.assign instead of util._extend
      const updatedAccount = Object.assign({}, account.toObject(), {
        website,
        username,
        password,
        email,
        logo,
        note,
        attachedFile: req.file ? req.file.path : account.attachedFile
      });

      account = await Account.findByIdAndUpdate(
        req.params.id,
        updatedAccount,
        { new: true }
      );

      res.json(account);
    } catch (err) {
      console.error('Update error:', err);
      res.status(500).json({ message: 'Server Error' });
    }
  }
);

// @route   DELETE /api/accounts/:id
// @desc    Delete account
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Make sure user owns account
    if (account.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Delete attached file if exists
    if (account.attachedFile) {
      fs.unlink(account.attachedFile, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }

    await account.remove();

    res.json({ message: 'Account removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router; 