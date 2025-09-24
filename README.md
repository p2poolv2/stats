# P2Poolv2/Hydrapool Stats

This project displays real-time and historical statistics for P2Poolv2
nodes and Hydrapool mining pool using data from the local disk.

## Deployment

### Docker

Clone the repository (git clone https://github.com/p2poolv2/stats)

```
docker compose build
```

```
docker compose up postgres
docker compose up stats
```

You will need to setup a cronjob on your host to run the following 

1. `pnpm update-users-from-logs` every minute
2. `pnpm cleanup` every five minutes

### Developer setup

1. Clone the repository (git clone https://github.com/p2poolv2/stats)
2. Install pnpm: `curl -fsSL https://get.pnpm.io/install.sh | bash`
3. Install packages if needed: `sudo apt install postgresql postgresql-contrib nodejs nginx`
4. Go to the directory: `cd ckstats`
5. Set up the environment variables in `.env`
  - Example:
   ```
   API_URL="<path to p2poolv2 stats directory>"
   DB_HOST="server"
   DB_PORT="port"
   DB_USER="username"
   DB_PASSWORD="password"
   DB_NAME="database"
   ```
   Replace `username`, `password`, `server`, `port`, `database` with your actual PostgreSQL credentials, server details, and database names.
   You can also set the DB_SSL to true if you want to use SSL and set the DB_SSL_REJECT_UNAUTHORIZED to true if you want to reject untrusted SSL certificates (like self-signed certificates).
   If PostgreSQL is running locally, you can make `DB_HOST` `/var/run/postgresql/` (which connects via a Unix socket).  The username and password are then ignored (authentication is done based on the Unix user connection to the socket).
   
6. Install dependencies: `pnpm install`
7. Run database migrations: `pnpm migration:run`
8. Seed the database and test the connection: `pnpm seed`
9. Build the application: `pnpm build`
10. Start the production server: `pnpm start`
11. Set up cronjobs for regular updates:
   - Open the crontab editor: `crontab -e`
   - Add lines to run the scripts.  Example:
     ```
     */1 * * * * cd /path/to/your/project && /usr/local/bin/pnpm seed
		*/1 * * * * cd /path/to/your/project && /usr/local/bin/pnpm update-users
     5 */2 * * * cd /path/to/your/project && /usr/local/bin/pnpm cleanup
     ```
   - Save and exit the editor
   
   These cronjobs will run the `seed` and `update-users` scripts every 1 minute to populate the database and clean up old statistics every 2 hours.


## Scripts

- `pnpm dev`: Start the development server
- `pnpm build`: Build the production application
- `pnpm start`: Start the production server
- `pnpm lint`: Run ESLint
- `pnpm lint:fix`: Run ESLint and fix issues
- `pnpm seed`: Save/Update pool stats to database
- `pnpm update-stats`: Update pool statistics #Currently not used
- `pnpm update-users`: Update user and worker information
- `pnpm cleanup`: Clean up old statistics
- `pnpm test`: Run tests
- `pnpm test:watch`: Run tests in watch mode
- `pnpm migration:run`: Run TypeORM database migrations
- `pnpm migration:run:skip`: Run TypeORM database migrations skipping the initial migration

## License

GPL-3.0 license
