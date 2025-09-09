import bcrypt from 'bcrypt';
const salt = 10;

export const hasher = {
  hash: (password: string): Promise<string> => {
    return bcrypt.hash(password, salt);
  },

  verify: (password: string, hashedPassword: string): Promise<boolean> => {
    return bcrypt.compare(password, hashedPassword);
  },
};
