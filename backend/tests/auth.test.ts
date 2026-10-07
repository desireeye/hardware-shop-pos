import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { hashPassword } from '../src/utils/password.js';

describe('Authentication and authorization', () => {
  const adminEmail = 'auth-admin@example.com';
  const staffEmail = 'auth-staff@example.com';

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN' },
    });

    const staffRole = await prisma.role.upsert({
      where: { name: 'STAFF' },
      update: {},
      create: { name: 'STAFF' },
    });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'Auth Admin',
        email: adminEmail,
        passwordHash: await hashPassword('StrongPass123!'),
        roleId: adminRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });

    await prisma.user.upsert({
      where: { email: staffEmail },
      update: {},
      create: {
        name: 'Auth Staff',
        email: staffEmail,
        passwordHash: await hashPassword('StaffPass123!'),
        roleId: staffRole.id,
        isActive: true,
        mustChangePassword: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, staffEmail],
        },
      },
    });
    await prisma.$disconnect();
  });

  it('allows a valid admin login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.role).toBe('ADMIN');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('allows a valid staff login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: staffEmail, password: 'StaffPass123!' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.role).toBe('STAFF');
  });

  it('rejects an invalid password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('rejects a non-existent email and password combination', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'missing@example.com', password: 'missing' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('blocks an inactive user', async () => {
    const inactiveUser = await prisma.user.create({
      data: {
        name: 'Inactive User',
        email: 'inactive@example.com',
        passwordHash: await hashPassword('Inactive123!'),
        roleId: (await prisma.role.findUniqueOrThrow({ where: { name: 'STAFF' } })).id,
        isActive: false,
        mustChangePassword: false,
      },
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@example.com', password: 'Inactive123!' });

    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('ACCOUNT_INACTIVE');

    await prisma.user.delete({ where: { id: inactiveUser.id } });
  });

  it('returns the authenticated user from /me', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.success).toBe(true);
    expect(meResponse.body.user.email).toBe(adminEmail);
  });

  it('logs out the current user', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.success).toBe(true);
  });

  it('blocks unauthenticated access to protected routes', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('UNAUTHORIZED');
  });

  it('allows admin access to the users endpoint', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const usersResponse = await request(app)
      .get('/api/users')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(usersResponse.status).toBe(200);
    expect(usersResponse.body.success).toBe(true);
  });

  it('blocks staff access to the users endpoint', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: staffEmail, password: 'StaffPass123!' });

    const usersResponse = await request(app)
      .get('/api/users')
      .set('Cookie', loginResponse.headers['set-cookie'][0]);

    expect(usersResponse.status).toBe(403);
    expect(usersResponse.body.errorCode).toBe('FORBIDDEN');
  });

  it('creates a staff account for the owner', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .post('/api/users')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: 'New Staff',
        email: 'new-staff@example.com',
        password: 'StrongPass456!',
        confirmPassword: 'StrongPass456!',
        role: 'STAFF',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    await prisma.user.delete({ where: { email: 'new-staff@example.com' } });
  });

  it('blocks a staff user from creating a new staff account', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: staffEmail, password: 'StaffPass123!' });

    const response = await request(app)
      .post('/api/users')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        name: 'Forbidden Staff',
        email: 'forbidden@example.com',
        password: 'StrongPass456!',
        confirmPassword: 'StrongPass456!',
        role: 'STAFF',
      });

    expect(response.status).toBe(403);
  });

  it('changes the user password when current password is correct', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: staffEmail, password: 'StaffPass123!' });

    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        currentPassword: 'StaffPass123!',
        newPassword: 'NewStaffPass456!',
        confirmPassword: 'NewStaffPass456!',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    await prisma.user.update({
      where: { email: staffEmail },
      data: { passwordHash: await hashPassword('StaffPass123!') },
    });
  });

  it('rejects a wrong current password on password change', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'StrongPass123!' });

    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', loginResponse.headers['set-cookie'][0])
      .send({
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('INVALID_CURRENT_PASSWORD');
  });
});
