const express = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/authValidators');

const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: create an account
 *     description: >
 *       attendee and exhibitor accounts are active immediately. an organizer
 *       account is created `pending` and cannot sign in until an existing
 *       organizer approves it, so the response carries `pendingApproval`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role, consentGiven]
 *             properties:
 *               name: { type: string, example: Ada Lovelace }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 8 }
 *               role: { type: string, enum: [organizer, exhibitor, attendee] }
 *               consentGiven: { type: boolean, example: true }
 *     responses:
 *       201: { description: account created; access token returned unless approval is pending }
 *       400: { $ref: '#/components/responses/RateLimited' }
 *       409: { description: That email is already registered }
 */
router.post('/register', authLimiter, validate(registerSchema), controller.register);
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Sign in
 *     description: returns an access token and sets the refresh token as an httpOnly cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200: { description: Signed in }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/login', authLimiter, validate(loginSchema), controller.login);
/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: exchange the refresh cookie for a new access token
 *     description: called silently by the client before expiry, so a session never drops mid-task.
 *     responses:
 *       200: { description: New access token }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: exchange the refresh cookie for a new access token
 *     description: >
 *       The httpOnly refresh cookie is sent automatically; there is no request
 *       body. This is what makes a session survive an expired access token
 *       without sending the user back to the sign-in page.
 *     responses:
 *       200:
 *         description: A fresh access token and the current user
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/refresh', controller.refresh);
/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: Clear the refresh cookie and revoke the session
 *     responses:
 *       200:
 *         description: Signed out
 */
router.post('/logout', controller.logout);
/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: send a password reset link
 *     description: >
 *       always answers 200, whether or not the address is registered — telling
 *       an anonymous caller which emails exist is an enumeration hole.
 *     responses:
 *       200: { description: If that address exists, a reset link has been sent }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     security: []
 *     summary: set a new password using a reset token
 *     description: >
 *       the token is single-use and valid for 30 minutes. succeeding ends
 *       every other signed-in session and sends a confirmation email, so a
 *       reset the account owner did not ask for is visible to them.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:    { type: string }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: password changed
 *       400:
 *         description: The token is invalid, used, or expired
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), controller.resetPassword);

// Cheap way for the client to confirm an access token is still good.
/**
 * @openapi
 * /auth/session:
 *   get:
 *     tags: [Auth]
 *     summary: who the current access token belongs to
 *     responses:
 *       200:
 *         description: the signed-in user
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/session', authMiddleware, (req, res) =>
  res.json({ success: true, data: { user: req.user.toPublic() }, message: 'Session active' })
);

module.exports = router;
