import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private adminClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('supabase.url')!;
    const serviceRoleKey = this.configService.get<string>(
      'supabase.serviceRoleKey',
    )!;

    this.adminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('Supabase admin client initialized');
  }

  /**
   * Get the Supabase admin client (service_role)
   * Use this for admin operations like creating users, deleting, etc.
   */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  /**
   * Get a Supabase user by their auth UID
   */
  async getAuthUser(uid: string) {
    const { data, error } = await this.adminClient.auth.admin.getUserById(uid);

    if (error) {
      this.logger.error(`Failed to get auth user ${uid}: ${error.message}`);
      return null;
    }

    return data.user;
  }

  /**
   * Create a user in Supabase Auth
   */
  async createAuthUser(
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
  ) {
    const { data, error } = await this.adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for now; in production, set to false and send verification email
      user_metadata: metadata || {},
    });

    if (error) {
      this.logger.error(`Failed to create auth user: ${error.message}`);
      throw error;
    }

    return data.user;
  }

  /**
   * Delete a user from Supabase Auth
   */
  async deleteAuthUser(uid: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.deleteUser(uid);

    if (error) {
      this.logger.error(`Failed to delete auth user ${uid}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user metadata in Supabase Auth
   */
  async updateAuthUser(
    uid: string,
    updates: {
      email?: string;
      password?: string;
      user_metadata?: Record<string, unknown>;
    },
  ) {
    const { data, error } = await this.adminClient.auth.admin.updateUserById(
      uid,
      updates,
    );

    if (error) {
      this.logger.error(`Failed to update auth user ${uid}: ${error.message}`);
      throw error;
    }

    return data.user;
  }

  /**
   * Send a magic-link / OTP email for verification.
   * Supabase uses signInWithOtp with `shouldCreateUser: false`
   * to re-send verification to an existing user.
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const { error } = await this.adminClient.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      this.logger.error(
        `Failed to resend verification for ${email}: ${error.message}`,
      );
      throw error;
    }

    this.logger.log(`Verification email re-sent to ${email}`);
  }

  /**
   * Check if a Supabase Auth user has confirmed their email.
   * Returns the confirmation timestamp or null.
   */
  async getEmailConfirmedAt(uid: string): Promise<string | null> {
    const user = await this.getAuthUser(uid);
    if (!user) return null;
    return user.email_confirmed_at || null;
  }
}
