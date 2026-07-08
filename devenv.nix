{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  env = {
    # https://devenv.sh/basics/
    "GREET" = "devenv";

    PORT = "8080";
    DB_USER = builtins.getEnv "USER";
    DB_NAME = "logithm";
  };

  packages = [
    pkgs.air # hot reload
    pkgs.golangci-lint
    pkgs.git
    pkgs.direnv
  ];

  languages.go.enable = true;

  services.postgres = {
    enable = true;
    package = pkgs.postgresql_18;
    listen_addresses = "";
    initialDatabases = [ { name = "logithm"; } ];
  };

  scripts.hello.exec = ''
    echo hello from $GREET
  '';

  enterShell = ''
    hello         # Run scripts directly
    git --version
  '';

  enterTest = ''
    echo "Running tests"
    git --version | grep --color=auto "${pkgs.git.version}"
  '';
}
