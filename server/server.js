const express = require("express");
const { PineconeClient } = require("@pinecone-database/pinecone");
const fs = require('fs');
const StreamArray = require( 'stream-json/streamers/StreamArray');
const {Writable} = require('stream');

const INIT_DB = false;
const book_index = require('./books_index.json');

const UPSERT_SIZE = 100;
const BOOK_TITLES = book_index.book_title;
const BOOK_ISBN = book_index.book_isbn;

const INDEX_NAME = "bert-books";
const NAMESPACE = "example_namespace";

const PORT = process.env.PORT || 3001;

const app = express();

const uploadDataChunk = async (pine_index, chunk_array) => {
    const start = Date.now();
    const upsertRequest = {
        vectors: chunk_array,
        namespace: NAMESPACE,
    };
    const upsertResponse = await pine_index.upsert({ upsertRequest });
    const end = Date.now();
    console.log(`Insertion of chunk took ${end - start} ms`, upsertResponse);
}

const upsertJsonInChunks = async (pine_index) => {
    const fileStream = fs.createReadStream('./bert_upsert.json');
    const jsonStream = StreamArray.withParser();
    let chunk_array = [];
    const processingStream = new Writable({
        write({key, value}, encoding, callback) {
            //some async operations
            if (key % UPSERT_SIZE == 0 && key != 0) {
                chunk_array.push(value);
                uploadDataChunk(pine_index, chunk_array).then(() => {
                    chunk_array = [];
                    callback();
                });
            } else {
                chunk_array.push(value);
                callback();
            }
        },
        //Don't skip this, as we need to operate with objects, not buffers
        objectMode: true
    });
    //Pipe the streams as follows
    fileStream.pipe(jsonStream.input);
    jsonStream.pipe(processingStream);
    //So we're waiting for the 'finish' event when everything is done.
    const finishedProcessing = new Promise((resolve, reject) => {
        processingStream.on('finish', () => {
            // Upsert rest of the chunk array
            uploadDataChunk(pine_index, chunk_array).then(() => {
                console.log('All done');
                chunk_array = [];
                resolve();
            })
        });
    });

    return finishedProcessing;
}

const pineconeInit = async () => {
    const pinecone = new PineconeClient();
    
    await pinecone.init({
      environment: "your-enviroment",
      apiKey: "your-key",
    });

    const indexStats = await pinecone.describeIndex({
        indexName: INDEX_NAME,
    });
    console.log('Using index:', indexStats.database.name);

    const pine_index = pinecone.Index(INDEX_NAME);

    if (INIT_DB) {
        await upsertJsonInChunks(pine_index);
    }

    return pine_index;
}

pineconeInit().then((pine_index) => {
    app.get("/api", async (req, res) => {
        const query_title = req.query.title;
        const query_exact = req.query.exact === "true";

        let title_index = -1
        if (query_exact) {
            title_index = BOOK_TITLES.findIndex((book_title) => book_title.toLowerCase() === query_title.toLowerCase());
        } else {
            title_index = BOOK_TITLES.findIndex((book_title) => book_title.toLowerCase().includes(query_title.toLowerCase()));
        }
        console.log('title_index', title_index)
        if (title_index == -1) {
            return res.status(400).send(`Book with titile ${query_title} is not in our Database.`);
        }

        const query_isbn = BOOK_ISBN[title_index];

        const fetchResponse =  await pine_index.fetch({
            ids: [query_isbn],
            namespace: NAMESPACE,
        });

        console.log('Fetched book: ', fetchResponse.vectors[query_isbn].id);

        const queryRequest = {
            "topK": 10,
            "includeMetadata": true,
            "namespace": NAMESPACE,
            "queries": [{
                "values": fetchResponse.vectors[query_isbn].values
            }]
        };

        const queryResponse = await pine_index.query({ queryRequest });

        res.json({"books": queryResponse.results[0].matches, "searched_for": fetchResponse, "searched_for_isbn": query_isbn})
    });
    
    app.listen(PORT, () => {
      console.log(`Server listening on ${PORT}`);
    });
});