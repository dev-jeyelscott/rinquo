<?php

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Actions\BootstrapAdmin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * Creates the first platform administrator. The password is read from a hidden prompt (never
 * an argument, so it cannot reach shell history or process listings) and is never printed.
 * Re-running it once any administrator exists changes nothing.
 */
class BootstrapAdminCommand extends Command
{
    protected $signature = 'platform:bootstrap-admin {email : Sign-in email of the first administrator} {--name= : Display name}';

    protected $description = 'Create the first platform administrator (no-op when one already exists)';

    public function handle(BootstrapAdmin $bootstrap): int
    {
        $email = (string) $this->argument('email');
        $name = (string) ($this->option('name') ?: 'Platform Administrator');

        if (Validator::make(['email' => $email], ['email' => ['required', 'email:rfc', 'max:254']])->fails()) {
            $this->components->error('Enter a valid email address.');

            return self::FAILURE;
        }

        $password = (string) $this->secret('Password (hidden, at least 12 characters)');
        $confirmation = (string) $this->secret('Confirm password');

        $check = Validator::make(['password' => $password, 'password_confirmation' => $confirmation], ['password' => ['required', 'confirmed', Password::min(12)->max(128)]]);
        if ($check->fails()) {
            $this->components->error($check->errors()->first('password'));

            return self::FAILURE;
        }

        if (! $bootstrap->handle($email, $name, $password)) {
            $this->components->info('A platform administrator already exists. Nothing changed.');

            return self::SUCCESS;
        }

        $this->components->info('Platform administrator created. They enroll an authenticator and receive recovery codes at first sign-in.');

        return self::SUCCESS;
    }
}
