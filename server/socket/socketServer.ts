module.exports = (io : any) => {
  io.on("connection", (socket : any) => {
    console.log("User connected:", socket.id);

    socket.on("send_message", (data : any) => {
      io.emit("receive_message", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
};