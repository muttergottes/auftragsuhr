#!/bin/bash
# Script to ensure admin login works after deployment

echo "🔧 Fixing admin login..."

# Wait for containers to be ready
sleep 10

# Generate a working bcrypt hash in the current container
echo "Generating bcrypt hash..."
HASH=$(docker exec auftragsuhr-server node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('admin123', 12).then(hash => console.log(hash));
" 2>/dev/null | tail -1)

if [ -z "$HASH" ]; then
    echo "❌ Failed to generate hash"
    exit 1
fi

echo "Generated hash: $HASH"

# Update the admin user in database
echo "Updating admin user..."
docker exec -i auftragsuhr-mysql mysql -u auftragsuhr_user -pStrongProdPassword2023! auftragsuhr << EOF
UPDATE users SET password_hash = '$HASH' WHERE role = 'admin';
EOF

echo "✅ Admin login fixed!"
echo "Login with: admin@admin.de / admin123"