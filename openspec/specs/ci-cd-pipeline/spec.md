## ADDED Requirements

### Requirement: GitHub Actions deploys on push to main
A GitHub Actions workflow SHALL trigger on pushes to the `main` branch. The workflow SHALL SSH into the DigitalOcean Droplet, pull the latest code, and run `docker compose up --build -d` to rebuild and restart the services.

#### Scenario: Code pushed to main triggers deployment
- **WHEN** a commit is pushed to the `main` branch
- **THEN** the GitHub Actions workflow SSHs into the Droplet, runs `git pull`, and executes `docker compose up --build -d`

#### Scenario: Deployment does not interrupt running bot
- **WHEN** the deploy workflow rebuilds the Docker image on the server
- **THEN** the existing bot container continues serving requests until the new container is ready, and Docker Compose replaces it with the new version

#### Scenario: Push to non-main branch does not deploy
- **WHEN** a commit is pushed to a branch other than `main`
- **THEN** the deploy workflow does NOT run

### Requirement: Deployment uses SSH key authentication
The workflow SHALL authenticate with the Droplet using an SSH private key stored as a GitHub Actions secret. The Droplet SHALL have the corresponding public key in its `authorized_keys`.

#### Scenario: SSH authentication succeeds
- **WHEN** the workflow attempts to SSH into the Droplet
- **THEN** it authenticates using the `SSH_PRIVATE_KEY` secret and connects successfully

#### Scenario: Missing secrets prevent deployment
- **WHEN** the required GitHub secrets (`SSH_PRIVATE_KEY`, `DROPLET_IP`, `DROPLET_USER`) are not configured
- **THEN** the workflow fails with a clear error message

### Requirement: Workflow requires specific GitHub secrets
The workflow SHALL use the following GitHub repository secrets: `DROPLET_IP` (server IP address), `DROPLET_USER` (SSH username, typically `deploy`), and `SSH_PRIVATE_KEY` (SSH private key for authentication).

#### Scenario: All secrets are configured
- **WHEN** all three secrets are set in the GitHub repository settings
- **THEN** the workflow connects to the Droplet and deploys successfully
