import jwt from 'jsonwebtoken';

interface TokenPayload {
    id: string;
    email: string;
    role: string;
}

const generateToken = (payload: TokenPayload): string => {
    const secret = process.env.JWT_SECRET || 'default_secret_key';

        return jwt.sign(payload, secret, {
            expiresIn: '365d'
        } as any);
};

export default generateToken;
