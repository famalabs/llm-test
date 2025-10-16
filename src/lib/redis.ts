export const escapeRedisValue = (value: string): string => {
    return value.replace(/([\\\/\.\-\{\}\[\]\(\)\"\'\:\|\<\>\@\~\+\=])/g, '\\$1');
}
