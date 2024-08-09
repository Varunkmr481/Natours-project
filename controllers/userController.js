const User = require('../models/userModel');
const multer = require('multer');
const sharp = require('sharp');
const catchAsync = require('../utils/catchAsync');
const AppError = require("../utils/appError");
const factory = require('./handlerFactory');

// const multerStorage = multer.diskStorage({
//   destination : (req, file, cb) => {
//     cb(null, 'public/img/users')
//   },
//   filename : (req, file, cb) => {
//     // unique fileName : user-userId-currentTimestamp.extension
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   }
// });

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if(file.mimetype.startsWith('image')){
    cb(null, true);
  }else{
    cb(new AppError('Not an image! Please upload only Images!',400), false);
  }
};

// INCLUDING MULTER AND ITS CONFIGURATIONS
const upload = multer({
  storage : multerStorage,
  fileFilter : multerFilter
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = (req, res, next) => {
  if(!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
}

// allowedFields here is ['name','email'] 

const filterObj = (obj , ...allowedFields)=>{
  const newObj = {};

  Object.keys(obj).forEach(el => {
    if(allowedFields.includes(el)){
      newObj[el] = obj[el];
    }
  });

  return newObj ;
}


exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};


exports.updateMe = catchAsync (async (req,res,next)=>{
      console.log(req.file);
      console.log(req.body);
      

      // 1) Create error if user tries to post password
      if(req.body.password || req.body.confirmPassword){
        return next(new AppError("This route is not for password Updates. Please use /updateMyPassword",400))
      }

      // 2) Filter out unwanted fields that are not allowed to be updated  
      const filteredBody = filterObj(req.body , 'name' , 'email');
      if(req.file) filteredBody.photo = req.file.filename;

      // 3) Update user document
      const updatedUser = await User.findByIdAndUpdate(req.user.id , filteredBody , {
        new : true,
        runValidators : true
      });

      res.status(200).json({
        status : 'success',
        data : {
          user : updatedUser
        }
      });
});  
  

exports.deleteMe = catchAsync( async (req,res,next)=>{

  await User.findByIdAndUpdate(req.user.id , {active : false});

  res.status(204).json({
    status : 'success',
    data : null
  })
})


exports.createUser = (req,res)=>{
    res.status(500).json({
      status : 'ERROR',
      message : "This route is not defined! Please use /signup instead"
    })
};


exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

// Do not update password with this ! (admin)  
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);