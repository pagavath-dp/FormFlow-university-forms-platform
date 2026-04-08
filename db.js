import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [ oracledb.CLOB ];

const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const connectString = process.env.DB_CONNECT_STRING;

export async function getConnection() {
    return await oracledb.getConnection({
        user: user,
        password: password,
        connectString: connectString
    });
}