// Example of how to use the logger throughout your application
const logger = require('./helper/logger');

// Example 1: Basic logging
logger.info('Application started');
logger.error('Database connection failed', { error: 'Connection timeout' });
logger.warn('High memory usage detected', { memoryUsage: '85%' });

// Example 2: Authentication logging
const loginUser = async (email, password) => {
  try {
    logger.info('User login attempt', { email });

    // Your authentication logic here
    const user = await authenticateUser(email, password);

    logger.logAuth('login_success', user.id, { email, loginTime: new Date() });
    return user;
  } catch (error) {
    logger.logAuth('login_failed', null, { email, error: error.message });
    throw error;
  }
};

// Example 3: Database operation logging
const createUser = async (userData) => {
  const start = Date.now();
  try {
    logger.info('Creating new user', { email: userData.email });

    const user = await User.create(userData);
    const duration = Date.now() - start;

    logger.logDatabase('create', 'users', duration, { userId: user.id });
    return user;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Failed to create user', {
      error: error.message,
      duration,
      userData: { email: userData.email },
    });
    throw error;
  }
};

// Example 4: API endpoint logging
const getUserProfile = async (req, res) => {
  try {
    logger.info('Fetching user profile', {
      userId: req.user.id,
      requestId: req.requestId,
    });

    const profile = await User.findById(req.user.id);

    logger.info('User profile fetched successfully', {
      userId: req.user.id,
      requestId: req.requestId,
    });

    res.json(profile);
  } catch (error) {
    logger.error('Failed to fetch user profile', {
      userId: req.user.id,
      requestId: req.requestId,
      error: error.message,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Example 5: Business logic logging
const processPayment = async (paymentData) => {
  logger.info('Processing payment', {
    amount: paymentData.amount,
    currency: paymentData.currency,
    userId: paymentData.userId,
  });

  try {
    // Payment processing logic
    const result = await processPaymentLogic(paymentData);

    logger.info('Payment processed successfully', {
      transactionId: result.transactionId,
      amount: paymentData.amount,
      userId: paymentData.userId,
    });

    return result;
  } catch (error) {
    logger.error('Payment processing failed', {
      amount: paymentData.amount,
      userId: paymentData.userId,
      error: error.message,
    });
    throw error;
  }
};

module.exports = {
  loginUser,
  createUser,
  getUserProfile,
  processPayment,
};
