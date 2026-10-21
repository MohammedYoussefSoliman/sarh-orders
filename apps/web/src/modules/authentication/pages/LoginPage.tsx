import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@sarh/shared';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';

import { Banner, Button, Card, Field, Input, PageLoader } from '@/components';
import { URLS } from '@/helpers';
import { normalizeError } from '@/lib';

import { useLogin, useMe } from '../services';

export function LoginPage() {
  const navigate = useNavigate();
  const { data: user, isPending } = useMe();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (isPending) return <PageLoader />;
  if (user) return <Navigate to={URLS.orders} replace />;

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => navigate(URLS.orders, { replace: true }),
    });
  });

  const error = login.error ? normalizeError(login.error) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink">Orders Console</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Sign in to view and create orders.
          </p>
        </div>

        {error && (
          <Banner tone="danger" className="mb-4">
            {error.message}
          </Banner>
        )}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              invalid={!!errors.email}
              {...register('email')}
            />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password?.message} required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>

          <Button type="submit" isLoading={login.isPending} block>
            Sign in
          </Button>
        </form>
      </Card>
    </main>
  );
}
