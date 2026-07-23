{ pkgs, lib, config, inputs, ... }: {
  env.GREET = "devenv";
  env.NODE_ENV = "development";
  env.PORT = "3000";
  env.MONGODB_URI = "mongodb://%2Ftmp%2Fmongodb-0.sock/logithm";
  env.JWT_ACCESS_EXPIRES_IN = "15m";
  env.JWT_REFRESH_EXPIRES_IN = "7d";

  packages = [ pkgs.git pkgs.direnv pkgs.nodejs-slim pkgs.pnpm ];

  languages.javascript.enable = true;

  services.mongodb = {
    enable = true;
    additionalArgs = [
      "--port" "0"
      "--noauth"
    ];
  };

  services.redis = {
    enable = true;
    port = 0;
    bind = "127.0.0.1";
  };

  scripts.hello.exec = "echo hello from $GREET";

  enterShell = ''
    hello
    git --version
  '';

  enterTest = ''
    echo "Running tests"
    git --version | grep --color=auto "${pkgs.git.version}"
  '';
}
