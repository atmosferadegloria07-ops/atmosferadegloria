const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// =====================================================
// ATMÓSFERA DE GLORIA
// SERVIDOR DE PAGOS WOMPI
// =====================================================


// =====================================================
// CARGAR .ENV
// =====================================================

const envPath = path.join(__dirname, ".env");

if (fs.existsSync(envPath)) {

    const envFile = fs.readFileSync(envPath, "utf8");

    envFile.split(/\r?\n/).forEach(line => {

        line = line.trim();

        if (!line || line.startsWith("#")) {
            return;
        }

        const posicion = line.indexOf("=");

        if (posicion === -1) {
            return;
        }

        const key = line.substring(0, posicion).trim();
        const value = line.substring(posicion + 1).trim();

        process.env[key] = value;
    });
}


// =====================================================
// CONFIGURACIÓN
// =====================================================

const PORT = Number(process.env.PORT || 3000);

const WOMPI_PUBLIC_KEY =
    process.env.WOMPI_PUBLIC_KEY;

const WOMPI_INTEGRITY_SECRET =
    process.env.WOMPI_INTEGRITY_SECRET;


// =====================================================
// BASE DE DATOS
// =====================================================

const databasePath =
    path.join(__dirname, "..", "database");

if (!fs.existsSync(databasePath)) {

    fs.mkdirSync(
        databasePath,
        {
            recursive: true
        }
    );
}

const ticketsFile =
    path.join(
        databasePath,
        "tickets.json"
    );


if (!fs.existsSync(ticketsFile)) {

    fs.writeFileSync(
        ticketsFile,
        "[]",
        "utf8"
    );
}


// =====================================================
// FUNCIONES DE TICKETS
// =====================================================

function leerTickets() {

    try {

        const contenido =
            fs.readFileSync(
                ticketsFile,
                "utf8"
            );

        return JSON.parse(
            contenido || "[]"
        );

    } catch (error) {

        console.error(
            "ERROR LEYENDO TICKETS:",
            error
        );

        return [];
    }
}


function guardarTickets(tickets) {

    fs.writeFileSync(
        ticketsFile,
        JSON.stringify(
            tickets,
            null,
            2
        ),
        "utf8"
    );
}


// =====================================================
// GENERAR CÓDIGO ÚNICO
// =====================================================

function generarCodigoTicket() {

    return (
        "ADG-" +
        Date.now() +
        "-" +
        crypto
            .randomBytes(5)
            .toString("hex")
            .toUpperCase()
    );
}


// =====================================================
// FUNCIÓN RESPUESTA JSON
// =====================================================

function responder(
    res,
    status,
    datos
) {

    res.writeHead(
        status,
        {
            "Content-Type":
                "application/json; charset=utf-8",

            "Access-Control-Allow-Origin":
                "*",

            "Access-Control-Allow-Methods":
                "GET, POST, OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type"
        }
    );

    res.end(
        JSON.stringify(datos)
    );
}


// =====================================================
// LEER BODY
// =====================================================

function leerBody(req) {

    return new Promise(
        (resolve, reject) => {

            let body = "";

            req.on(
                "data",
                chunk => {

                    body +=
                        chunk.toString();
                }
            );

            req.on(
                "end",
                () => {

                    try {

                        resolve(
                            JSON.parse(
                                body || "{}"
                            )
                        );

                    } catch (error) {

                        reject(
                            new Error(
                                "JSON inválido."
                            )
                        );
                    }
                }
            );

            req.on(
                "error",
                reject
            );
        }
    );
}


// =====================================================
// SERVIDOR
// =====================================================

const server =
    http.createServer(
        async (req, res) => {


            // =================================================
            // CORS
            // =================================================

            res.setHeader(
                "Access-Control-Allow-Origin",
                "*"
            );

            res.setHeader(
                "Access-Control-Allow-Methods",
                "GET, POST, OPTIONS"
            );

            res.setHeader(
                "Access-Control-Allow-Headers",
                "Content-Type"
            );


            // =================================================
            // OPTIONS
            // =================================================

            if (
                req.method ===
                "OPTIONS"
            ) {

                res.writeHead(204);

                res.end();

                return;
            }

// ============================================
// SERVIR ARCHIVOS HTML, CSS, JS E IMÁGENES
// ============================================

if (req.method === "GET") {

    let filePath = req.url === "/"
        ? "index.html"
        : req.url.substring(1);

    // evitar rutas raras
    filePath = path.join(__dirname, "..", filePath);

    if (fs.existsSync(filePath)) {

        const ext = path.extname(filePath);

        const tipos = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".json": "application/json"
        };

        res.writeHead(200, {
            "Content-Type": tipos[ext] || "text/plain"
        });

        res.end(fs.readFileSync(filePath));
        return;
    }
}
            // =================================================
            // SERVIDOR FUNCIONANDO
            // =================================================

            if (
                req.method === "GET" &&
                req.url === "/"
            ) {

                responder(
                    res,
                    200,
                    {
                        success: true,

                        message:
                            "Servidor Atmósfera de Gloria funcionando",

                        wompi:
                            WOMPI_PUBLIC_KEY
                                ? "OK"
                                : "FALTA",

                        integrity:
                            WOMPI_INTEGRITY_SECRET
                                ? "OK"
                                : "FALTA",

                        port:
                            PORT
                    }
                );

                return;
            }

// =====================================================
// VALIDAR TICKET
// =====================================================

if (
    req.method === "GET" &&
    (req.url === "/validar-ticket" ||
     req.url === "/validar-ticket.html")
) {
    const archivo = path.join(__dirname, "..", "validar-ticket.html");

    fs.readFile(archivo, "utf8", (error, contenido) => {
        if (error) {
            console.error("ERROR AL CARGAR validar-ticket.html:", error);

            res.writeHead(500, {
                "Content-Type": "text/plain; charset=utf-8"
            });

            res.end("Error al cargar validar-ticket.html");
            return;
        }

        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        res.end(contenido);
    });

    return;
}
            // =================================================
            // CREAR PAGO
            // =================================================

            if (
                req.method === "POST" &&
                req.url === "/api/crear-pago"
            ) {

                try {

                    const datos =
                        await leerBody(req);


                    const amountInCents =
                        Number(
                            datos.amountInCents
                        );


                    const currency =
                        datos.currency ||
                        "COP";


                    // -----------------------------------------
                    // VALIDAR MONTO
                    // -----------------------------------------

                    if (
                        !amountInCents ||
                        amountInCents <= 0
                    ) {

                        throw new Error(
                            "El monto del pago no es válido."
                        );
                    }


                    // -----------------------------------------
                    // VALIDAR MONEDA
                    // -----------------------------------------

                    if (
                        currency !== "COP"
                    ) {

                        throw new Error(
                            "La moneda debe ser COP."
                        );
                    }


                    // -----------------------------------------
                    // VALIDAR LLAVES
                    // -----------------------------------------

                    if (
                        !WOMPI_PUBLIC_KEY
                    ) {

                        throw new Error(
                            "WOMPI_PUBLIC_KEY no está configurada en .env."
                        );
                    }


                    if (
                        !WOMPI_INTEGRITY_SECRET
                    ) {

                        throw new Error(
                            "WOMPI_INTEGRITY_SECRET no está configurada en .env."
                        );
                    }


                    // -----------------------------------------
                    // CREAR REFERENCIA ÚNICA
                    // -----------------------------------------

                    const reference =
                        "ADG-" +
                        Date.now() +
                        "-" +
                        crypto
                            .randomBytes(4)
                            .toString("hex")
                            .toUpperCase();


                    // -----------------------------------------
                    // FIRMA DE INTEGRIDAD
                    // -----------------------------------------

                    const textoFirma =
                        reference +
                        amountInCents +
                        currency +
                        WOMPI_INTEGRITY_SECRET;


                    const signature =
                        crypto
                            .createHash("sha256")
                            .update(
                                textoFirma,
                                "utf8"
                            )
                            .digest("hex");


                    console.log("");
                    console.log(
                        "===================================="
                    );

                    console.log(
                        "NUEVO PAGO"
                    );

                    console.log(
                        "Referencia:",
                        reference
                    );

                    console.log(
                        "Monto:",
                        amountInCents
                    );

                    console.log(
                        "Firma:",
                        signature
                    );

                    console.log(
                        "===================================="
                    );


                    // -----------------------------------------
                    // RESPONDER AL FRONTEND
                    // -----------------------------------------

                    responder(
                        res,
                        200,
                        {

                            success: true,

                            publicKey:
                                WOMPI_PUBLIC_KEY,

                            reference:
                                reference,

                            amountInCents:
                                amountInCents,

                            currency:
                                currency,

                            signature:
                                signature
                        }
                    );

                    return;


                } catch (error) {

                    console.error(
                        "ERROR CREANDO PAGO:",
                        error
                    );


                    responder(
                        res,
                        400,
                        {

                            success: false,

                            error:
                                error.message
                        }
                    );

                    return;
                }
            }


            // =================================================
            // CREAR COMPROBANTE
            // =================================================

            if (
                req.method === "POST" &&
                req.url === "/api/crear-comprobante"
            ) {

                try {

                    const datos =
                        await leerBody(req);


                    const transactionId =
                        datos.transactionId;


                    if (!transactionId) {

                        throw new Error(
                            "Falta el ID de la transacción."
                        );
                    }


                    console.log("");
                    console.log(
                        "===================================="
                    );

                    console.log(
                        "VERIFICANDO PAGO"
                    );

                    console.log(
                        "Transacción:",
                        transactionId
                    );

                    console.log(
                        "===================================="
                    );


                    // -----------------------------------------
                    // CONSULTAR WOMPI
                    // -----------------------------------------

                    const respuesta =
                   await fetch(
                "https://api-sandbox.wompi.co/v1/transactions/" +
                    encodeURIComponent(
                      transactionId
                       )
                          );


                    const resultado =
                        await respuesta.json();


                    console.log(
                        "RESPUESTA WOMPI:",
                        resultado
                    );


                    if (!respuesta.ok) {

                        throw new Error(
                            "Wompi no pudo consultar la transacción."
                        );
                    }


                    const transaccion =
                        resultado.data;


                    if (!transaccion) {

                        throw new Error(
                            "No encontramos la transacción."
                        );
                    }


                    // -----------------------------------------
                    // VERIFICAR ESTADO
                    // -----------------------------------------

                    if (
                        transaccion.status !==
                        "APPROVED"
                    ) {

                        throw new Error(
                            "El pago no está aprobado. Estado: " +
                            transaccion.status
                        );
                    }


                    // -----------------------------------------
                    // LEER TICKETS
                    // -----------------------------------------

                    const tickets =
                        leerTickets();


                    // -----------------------------------------
                    // EVITAR DUPLICADOS
                    // -----------------------------------------

                    const existente =
                        tickets.find(
                            ticket =>
                                ticket.transactionId ===
                                transactionId
                        );


                    if (existente) {

                        responder(
                            res,
                            200,
                            {

                                success: true,

                                ticket:
                                    existente
                            }
                        );

                        return;
                    }


                    // -----------------------------------------
                    // CREAR TICKET
                    // -----------------------------------------

                    const codigoTicket =
                        generarCodigoTicket();


                    const ticket = {

                        ticketId:
                            codigoTicket,

                        transactionId:
                            transactionId,

                        reference:
                            transaccion.reference,

                        status:
                            "PAGADO",

                        amountInCents:
                            transaccion.amount_in_cents,

                        amount:
                            transaccion.amount_in_cents / 100,

                        currency:
                            transaccion.currency,

                        paymentMethod:
                            transaccion.payment_method_type,

                        createdAt:
                            new Date().toISOString(),

                        used:
                            false
                    };


                    // -----------------------------------------
                    // GUARDAR TICKET
                    // -----------------------------------------

                    tickets.push(
                        ticket
                    );

                    guardarTickets(
                        tickets
                    );


                    console.log("");
                    console.log(
                        "===================================="
                    );

                    console.log(
                        "COMPROBANTE CREADO"
                    );

                    console.log(
                        "Ticket:",
                        codigoTicket
                    );

                    console.log(
                        "Referencia:",
                        transaccion.reference
                    );

                    console.log(
                        "===================================="
                    );


                    // -----------------------------------------
                    // RESPONDER
                    // -----------------------------------------

                    responder(
                        res,
                        200,
                        {

                            success: true,

                            ticket:
                                ticket
                        }
                    );

                    return;


                } catch (error) {

                    console.error(
                        "ERROR CREANDO COMPROBANTE:",
                        error
                    );


                    responder(
                        res,
                        400,
                        {

                            success: false,

                            error:
                                error.message
                        }
                    );

                    return;
                }
            }


            // =================================================
            // CONSULTAR TICKET
            // =================================================

            if (
                req.method === "GET" &&
                req.url.startsWith(
                    "/api/ticket/"
                )
            ) {

                try {

                    const codigo =
                        decodeURIComponent(
                            req.url
                                .replace(
                                    "/api/ticket/",
                                    ""
                                )
                                .split("?")[0]
                        );


                    const tickets =
                        leerTickets();


                    const ticket =
                        tickets.find(
                            item =>
                                item.ticketId ===
                                codigo
                        );


                    if (!ticket) {

                        responder(
                            res,
                            404,
                            {

                                success: false,

                                error:
                                    "Ticket no encontrado."
                            }
                        );

                        return;
                    }


                    responder(
                        res,
                        200,
                        {

                            success: true,

                            ticket:
                                ticket
                        }
                    );

                    return;


                } catch (error) {

                    responder(
                        res,
                        500,
                        {

                            success: false,

                            error:
                                error.message
                        }
                    );

                    return;
                }
            }

// ============================================================
// USAR / VALIDAR TICKET
// ============================================================

if (
    req.method === "POST" &&
    req.url.startsWith("/api/usar-ticket/")
) {

    try {

        // ------------------------------------------------------
        // OBTENER CÓDIGO DEL TICKET
        // ------------------------------------------------------

        const codigo = decodeURIComponent(
            req.url
                .replace("/api/usar-ticket/", "")
                .split("?")[0]
        );

        console.log("");
        console.log("========================================");
        console.log("VALIDANDO TICKET");
        console.log("Código:", codigo);
        console.log("========================================");


        // ------------------------------------------------------
        // VALIDAR QUE EXISTE EL CÓDIGO
        // ------------------------------------------------------

        if (!codigo) {

            responder(
                res,
                400,
                {
                    success: false,
                    error: "Falta el código del ticket."
                }
            );

            return;
        }


        // ------------------------------------------------------
        // LEER TICKETS
        // ------------------------------------------------------

        const tickets = leerTickets();


        // ------------------------------------------------------
        // BUSCAR TICKET
        // ------------------------------------------------------

        const indice = tickets.findIndex(
            ticket =>
                ticket.ticketId === codigo
        );


        // ------------------------------------------------------
        // TICKET NO EXISTE
        // ------------------------------------------------------

        if (indice === -1) {

            console.log("TICKET NO ENCONTRADO");

            responder(
                res,
                404,
                {
                    success: false,
                    error: "Ticket no encontrado."
                }
            );

            return;
        }


        // ------------------------------------------------------
        // OBTENER TICKET
        // ------------------------------------------------------

        const ticket = tickets[indice];


        console.log("Ticket encontrado:");
        console.log(ticket);


        // ------------------------------------------------------
        // VERIFICAR SI YA FUE UTILIZADO
        // ------------------------------------------------------

        if (ticket.used === true) {

            console.log("TICKET YA UTILIZADO");

            responder(
                res,
                409,
                {
                    success: false,
                    usado: true,
                    error: "Este ticket ya fue utilizado.",
                    ticket: ticket
                }
            );

            return;
        }


        // ------------------------------------------------------
        // VERIFICAR QUE ESTÉ PAGADO
        // ------------------------------------------------------

        if (
            ticket.status !== "PAGADO" &&
            ticket.status !== "APPROVED"
        ) {

            console.log(
                "TICKET NO PAGADO:",
                ticket.status
            );

            responder(
                res,
                403,
                {
                    success: false,
                    error: "Este ticket no está pagado.",
                    ticket: ticket
                }
            );

            return;
        }


        // ------------------------------------------------------
        // MARCAR TICKET COMO UTILIZADO
        // ------------------------------------------------------

        tickets[indice].used = true;

        tickets[indice].usedAt =
            new Date().toISOString();


        // ------------------------------------------------------
        // GUARDAR CAMBIOS
        // ------------------------------------------------------

        guardarTickets(tickets);


        // ------------------------------------------------------
        // CONFIRMAR
        // ------------------------------------------------------

        console.log("");
        console.log("========================================");
        console.log("TICKET VALIDADO CORRECTAMENTE");
        console.log("Ticket:", ticket.ticketId);
        console.log("Estado: PAGADO");
        console.log("Usado: true");
        console.log("========================================");
        console.log("");


        responder(
            res,
            200,
            {
                success: true,
                mensaje: "Ticket válido. Entrada autorizada.",
                ticket: tickets[indice]
            }
        );

        return;


    } catch (error) {

        console.error(
            "ERROR VALIDANDO TICKET:",
            error
        );


        responder(
            res,
            500,
            {
                success: false,
                error: error.message
            }
        );

        return;
    }
}
            // =================================================
            // CONSULTAR TRANSACCIÓN WOMPI
            // =================================================

            if (
                req.method === "GET" &&
                req.url.startsWith(
                    "/api/transaccion/"
                )
            ) {

                try {

                    const transactionId =
                        decodeURIComponent(
                            req.url
                                .split(
                                    "/api/transaccion/"
                                )[1]
                                .split("?")[0]
                        );


                    if (!transactionId) {

                        throw new Error(
                            "Falta el ID de la transacción."
                        );
                    }


                    const respuesta =
                        await fetch(
                            "https://sandbox.wompi.co/v1/transactions/" +
                            encodeURIComponent(
                                transactionId
                            )
                        );


                    const resultado =
                        await respuesta.json();


                    responder(
                        res,
                        respuesta.ok
                            ? 200
                            : respuesta.status,
                        {

                            success:
                                respuesta.ok,

                            transaction:
                                resultado.data,

                            wompi:
                                resultado
                        }
                    );

                    return;


                } catch (error) {

                    console.error(
                        "ERROR CONSULTANDO TRANSACCIÓN:",
                        error
                    );


                    responder(
                        res,
                        500,
                        {

                            success: false,

                            message:
                                "Error consultando la transacción.",

                            error:
                                error.message
                        }
                    );

                    return;
                }
            }


            // =================================================
            // RUTA NO ENCONTRADA
            // =================================================

            responder(
                res,
                404,
                {

                    success: false,

                    message:
                        "Not Found"
                }
            );

        }
    );


// =====================================================
// INICIAR SERVIDOR
// =====================================================

server.listen(PORT,"0.0.0.0", () => {

        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "ATMÓSFERA DE GLORIA"
        );

        console.log(
            "SERVIDOR WOMPI"
        );

        console.log(
            "======================================"
        );

        console.log("");

        console.log(
            "Public Key:",
            WOMPI_PUBLIC_KEY
                ? "OK"
                : "FALTA"
        );

        console.log(
            "Integrity Secret:",
            WOMPI_INTEGRITY_SECRET
                ? "OK"
                : "FALTA"
        );

        console.log(
            "Puerto:",
            PORT
        );

        console.log("");

        console.log(
            `Servidor funcionando en http://localhost:${PORT}`
        );

        console.log("");
    }
);