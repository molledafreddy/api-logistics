import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  privateKey: (process.env.JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  publicKey: (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
  accessTokenTtl: parseInt(process.env.JWT_ACCESS_TOKEN_TTL || '900', 10),
  refreshTokenTtl: parseInt(process.env.JWT_REFRESH_TOKEN_TTL || '604800', 10),
}));
