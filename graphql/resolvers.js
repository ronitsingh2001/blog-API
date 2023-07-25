const User = require('../models/user')
const Post = require('../models/post')
const bcrypt = require('bcryptjs')
const validator = require('validator')
const jwt = require('jsonwebtoken')
const clearImage = require('../utils/clearImage')

module.exports = {

    createUser: async function ({ userInput }, req) {
        const errors = []
        if (!validator.isEmail(userInput.email)) {
            errors.push({ message: 'Email is invalid.' })
        }
        if (
            validator.isEmpty(userInput.password) ||
            !validator.isLength(userInput.password, { min: 4 })
        ) {
            errors.push({ message: 'Password is too short.' })
        }
        if (errors.length > 0) {
            const error = new Error('Invalid Input!')
            error.data = errors;
            error.code = 422;
            throw error
        }

        const existingUser = await User.findOne({ email: userInput.email })
        if (existingUser) {
            const error = new Error('User Already exists!')
            throw error
        }
        const hashedPw = await bcrypt.hash(userInput.password, 12);
        const user = new User({
            email: userInput.email,
            name: userInput.name,
            password: hashedPw,
            // email: userInput.email,
        })
        const createdUser = await user.save();
        return {
            ...createdUser._doc,
            _id: createdUser._id.toString()
        }
    },

    login: async function ({ email, password }, req) {
        const errors = []
        if (!validator.isEmail(email)) {
            errors.push({ message: 'Email is invalid.' })
        }
        if (
            validator.isEmpty(password) ||
            !validator.isLength(password, { min: 4 })
        ) {
            errors.push({ message: 'Password is too short.' })
        }
        if (errors.length > 0) {
            const error = new Error('Invalid Input!')
            error.data = errors;
            error.code = 422;
            throw error
        }
        const user = await User.findOne({ email: email });
        if (!user) {
            const error = new Error('User Not Found!')
            error.code = 401;
            throw error
        }
        const isEqual = await bcrypt.compare(password, user.password);
        if (!isEqual) {
            const error = new Error('Password is incorrect.')
            error.code = 401;
            throw error
        }
        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email
            },
            'secret',
            { expiresIn: '1h' }
        );
        return { token: token, userId: user._id.toString() }
    },
    createPost: async function ({ postInput }, req) {
        if (!req.isAuth) {
            const error = new Error("Not Authenticated!")
            error.code = 401;
            throw error;
        }
        const errors = []
        if (validator.isEmpty(postInput.title) ||
            !validator.isLength(postInput.title, { min: 4 })) {
            errors.push({ message: 'Title is too short.' })
        }
        if (
            validator.isEmpty(postInput.content) ||
            !validator.isLength(postInput.content, { min: 4 })
        ) {
            errors.push({ message: 'content is too short.' })
        }
        if (errors.length > 0) {
            const error = new Error('Invalid Input!')
            error.data = errors;
            error.code = 422;
            throw error
        }
        const user = await User.findById('64bcf3be671701989b7f30b3');
        if (!user) {
            const error = new Error("Invalid User!")
            error.code = 401;
            throw error;
        }
        const post = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user
        })
        const postData = await post.save()
        user.posts.push(postData)
        await user.save()
        // console.log(postData)
        return {
            ...postData._doc,
            _id: postData._id.toString(),
            createdAt: postData.createdAt.toISOString(),
            updatedAt: postData.updatedAt.toISOString()
        }
    },
    updatePost: async function ({ id, postInput }, req) {
        if (!req.isAuth) {
            const error = new Error("Not Authenticated!")
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id).populate('creator')
        if (!post) {
            const error = new Error("No post found!")
            error.code = 404;
            throw error;
        }
        if (post.creator._id.toString() !== req.userId.toString()) {
            const error = new Error("Not Authenticated!")
            error.code = 403;
            throw error;
        }
        const errors = []
        if (validator.isEmpty(postInput.title) ||
            !validator.isLength(postInput.title, { min: 4 })) {
            errors.push({ message: 'Title is too short.' })
        }
        if (
            validator.isEmpty(postInput.content) ||
            !validator.isLength(postInput.content, { min: 4 })
        ) {
            errors.push({ message: 'content is too short.' })
        }
        if (errors.length > 0) {
            const error = new Error('Invalid Input!')
            error.data = errors;
            error.code = 422;
            throw error
        }
        post.title = postInput.title;
        post.content = postInput.content;
        if (postInput.imageUrl !== 'undefined') {
            post.imageUrl = postInput.imageUrl;
        }
        const updatedPost = await post.save()
        return {
            ...updatedPost._doc,
            _id: updatedPost._id.toString(),
            createdAt: updatedPost.createdAt.toISOString(),
            updatedAt: updatedPost.updatedAt.toISOString()
        }
    }
    ,
    posts: async function ({ page, limit }, req) {
        if (!req.isAuth) {
            const error = new Error("Not Authenticated!")
            error.code = 401;
            throw error;
        }

        const totalPosts = await Post.find().countDocuments();
        const posts = await Post
            .find().sort({ createdAt: -1 })
            .skip(((page || 1) - 1) * (limit || 5))
            .limit((limit || 5))
            .populate('creator')

        return {
            posts: posts.map(post => {
                return {
                    ...post._doc,
                    _id: post._id.toString(),
                    createdAt: post.createdAt.toISOString(),
                    updatedAt: post.updatedAt.toISOString()
                }
            }),
            totalPosts: totalPosts
        }
    },

    post: async function ({ id }, req) {
        if (!req.isAuth) {
            const error = new Error("Not Authenticated!")
            error.code = 401;
            throw error;
        }

        const post = await Post.findById(id).populate('creator')
        if (!post) {
            const error = new Error("No post found!")
            error.code = 404;
            throw error;
        }
        return { ...post._doc, _id: post._id.toString(), createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString() }
    },
    deletePost: async function ({ id }, req) {
        if (!req.isAuth) {
            const error = new Error("Not Authenticated!")
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id);
        if (!post) {
            const error = new Error("No post found!")
            error.code = 404;
            throw error;
        }

        if (post.creator.toString() !== req.userId.toString()) {
            const error = new Error("Not Authenticated!")
            error.code = 403;
            throw error;
        }
        clearImage(post.imageUrl)
        await Post.findByIdAndRemove(id);
        const user = await User.findById(req.userId);
        user.posts.pull(id);
        await user.save()
        return true;
    },
    user: async function (args, req) {
        if (!req.isAuth) {
            const error = new Error("Not Authenticated!")
            error.code = 401;
            throw error;
        }
        const user = await User.findById(req.userId.toString())
        if (!user) {
            const error = new Error("No User found!")
            error.code = 401;
            throw error;
        }
        return { ...user._doc, _id: user._id.toString() }
    },
    updateStatus: async function ({ status }, req) {
        if (!req.isAuth) {
            const error = new Error("Not Authenticated!")
            error.code = 401;
            throw error;
        }
        const user = await User.findById(req.userId.toString())
        if (!user) {
            const error = new Error("No User found!")
            error.code = 401;
            throw error;
        }
        user.status = status;
        await user.save()
        return { ...user._doc, _id: user._id.toString() }
    }
}


