import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import db from '../config/database.js';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectRedis } from '../services/redisCache.js';

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        'https://procurement.xandree.com',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.use(async (socket,next) => {
    try {
      const decoded=jwt.verify(socket.handshake.auth?.token,process.env.JWT_SECRET || 'your-secret-key');
      const [users]=await db.query('SELECT id,role,is_active FROM employees WHERE id=?',[decoded.id]);
      if(!users[0]?.is_active)return next(new Error('Inactive or missing user'));
      socket.data.user=users[0]; next();
    } catch {next(new Error('Authentication required'));}
  });
  connectRedis().then(async client=>{
    if(!client)return;
    const subscriber=client.duplicate();subscriber.on('error',()=>{});
    try{await subscriber.connect();io.adapter(createAdapter(client,subscriber));}catch{console.warn('Redis socket adapter unavailable; local delivery and refresh recovery remain active');}
  });
  io.on('connection', (socket) => {
    socket.join(`user_${socket.data.user.id}`);
    socket.join(`role_${socket.data.user.role}`);
    console.log('Client connected:', socket.id);

    // Join user-specific room for targeted notifications
    socket.on('join', (userId) => {
      if (Number(userId) !== Number(socket.data.user.id)) return;
      socket.join(`user_${socket.data.user.id}`);
      console.log(`User ${userId} joined their room`);
    });

    // Join role-specific rooms
    socket.on('join_role', (role) => {
      if (role !== socket.data.user.role) return;
      socket.join(`role_${socket.data.user.role}`);
      console.log(`Socket joined role room: ${role}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Helper functions to emit events
export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

export const emitToRole = (role, event, data) => {
  if (io) {
    io.to(`role_${role}`).emit(event, data);
  }
};

export const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};
