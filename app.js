const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors package
const mongoose = require('mongoose');
const multer = require('multer');
const { graphqlHTTP } = require('express-graphql');
const graphqlSchema = require('./graphql/schema');
const graphqlResolvers = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const path = require('path');
const clearImage = require('./utils/clearImage');


// const feedRoutes = require('./redundant/routes/feed');
// const authRoutes = require('./redundant/routes/auth');

const MONGO_URI = 'mongodb+srv://ronit2001krish:kkNCbvJXytrV5fFe@cluster0.pzq3t8g.mongodb.net/messages'

const app = express();

const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images'); // Destination directory relative to your project root
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + file.originalname;
    cb(null, uniqueSuffix);
  },
});


const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/avif'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json()); // application/json
app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'))
app.use('/images', express.static(path.join(__dirname, 'images')))

// Use the cors middleware to enable CORS
app.use(cors());

// app.use('/feed', feedRoutes);
// app.use('/auth', authRoutes);

app.use(auth)

app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    throw new Error("Not Authenticated!")
  }
  if (!req.file) {
    return res.status(200).json({ message: 'No File provided!' })
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath)
  }
  return res.status(201).json({ message: 'File Stored', filePath: req.file.path })
})


app.get('/',(req, res, next)=>{
  res.json({message:'I Am Alive'})
})

app.use('/graphql', graphqlHTTP({
  schema: graphqlSchema,
  rootValue: graphqlResolvers,
  graphiql: true,
  customFormatErrorFn(err) {
    if (!err.originalError) {
      return err
    }
    const data = err.originalError.data;
    const message = err.message || 'An error occured!';
    const code = err.originalError.code || 500;
    return { message: message, code: code, data: data }
  }
}))


app.use((error, req, res, next) => {
  console.log(error)
  const status = error.statusCode || 500;
  const errMessage = error.message;
  const data = error.data;
  res.status(status).json({
    message: errMessage,
    data: data
  })
})


mongoose.connect(MONGO_URI)
  .then(result => {
    console.log('Connected')
    // const server = 
    app.listen(8080, () => {
      console.log('Server is running on http://localhost:8080');
    })
    // return server;
  })
  // .then(res => {
  // const io = require('./redundant/socket').init(res);
  // io.on('connection', socket => {
  //   console.log('Client Connected!')
  // })
  // })
  .catch(err => {
    console.log(err)
  })



