import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { findAuthorizedAdminByEmail, getOrCreateUser } from '../db/repository.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  adminUser?: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

function drainIncomingBody(req: AuthRequest) {
  if (req.readable && !req.readableEnded) {
    req.resume();
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    drainIncomingBody(req);
    res.status(401).json({ error: 'Não autorizado. Faça login para continuar.' });
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    drainIncomingBody(req);
    res.status(401).json({ error: 'Não autorizado. Token de acesso ausente.' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const email = (decodedToken.email || '').trim().toLowerCase();
    const displayName = typeof decodedToken.name === 'string' ? decodedToken.name : '';

    await getOrCreateUser(decodedToken.uid, email, displayName);

    const adminRecord = await findAuthorizedAdminByEmail(email);
    if (!adminRecord) {
      drainIncomingBody(req);
      res.status(403).json({
        error: 'Acesso restrito: este e-mail Google não possui permissão administrativa.',
      });
      return;
    }

    req.adminUser = {
      id: adminRecord.id,
      email: adminRecord.email,
      name: displayName || adminRecord.name,
      role: adminRecord.role,
    };

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    drainIncomingBody(req);
    res.status(401).json({ error: 'Sessão expirada ou inválida. Entre novamente com Google.' });
  }
};
